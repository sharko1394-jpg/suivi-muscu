import { isCountedSet } from './calc';
import { db, type AppDB } from './db';
import {
  GOAL_LIMITS,
  MAX_PERSONAL_GOALS,
  isValidDay,
  type PersonalGoal,
  type PersonalGoalKind,
} from './goalsModel';
import { getSettings, setSetting } from './settings';
import { BODYWEIGHT_LIMITS } from './stats';
import { daysBetween } from './streak';
import type { ID } from './types';
import { AppError, localDate, newId } from './util';

// Objectifs personnels : « 100 kg × 5 au développé couché », « 75 kg de poids de corps »,
// « 50 séances ». L'avancement est recalculé à partir de l'historique, rien d'autre n'est stocké.

export interface GoalStatus {
  goal: PersonalGoal;
  /** Ce qui est visé : nom de l'exercice, « Poids de corps » ou « Séances ». */
  title: string;
  /** Valeur suivie : charge (kg), répétitions, poids de corps (kg) ou nombre de séances. */
  unit: 'kg' | 'reps' | 'sessions';
  startValue: number;
  targetValue: number;
  /** Où on en est ; null tant que rien n'a été fait (ou pesé). */
  current: number | null;
  /** Avancement entre le point de départ et la cible, de 0 à 1. */
  ratio: number;
  /** Jour où l'objectif a été atteint. */
  achievedOn: string | null;
  /** Jours restants jusqu'à la date limite (négatif : dépassée) ; null sans date limite. */
  daysLeft: number | null;
}

export interface GoalContext {
  /** Séries qui comptent, par exercice. */
  lifts: Map<ID, { weight: number; reps: number; date: string }[]>;
  weighIns: { date: string; weightKg: number }[];
  /** Séances terminées. */
  sessions: { date: string; startedAt: number }[];
  names: Map<ID, string>;
  today: string;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Valeur suivie pour un objectif de charge : la charge (si au moins N répétitions), ou les répétitions au poids du corps. */
function liftValue(goal: PersonalGoal, lift: { weight: number; reps: number }): number | null {
  if (goal.target > 0) return lift.reps >= goal.reps ? lift.weight : null;
  return lift.reps;
}

/** Cible d'un objectif de charge : la charge, ou les répétitions quand on vise 0 kg (poids du corps). */
export const liftTarget = (goal: Pick<PersonalGoal, 'target' | 'reps'>) => (goal.target > 0 ? goal.target : goal.reps);

/** Meilleure valeur déjà faite pour un objectif de charge. */
export function bestLiftValue(
  goal: Pick<PersonalGoal, 'target' | 'reps'>,
  lifts: { weight: number; reps: number }[],
): number | null {
  let best: number | null = null;
  for (const lift of lifts) {
    const value = liftValue(goal as PersonalGoal, lift);
    if (value !== null && (best === null || value > best)) best = value;
  }
  return best;
}

export function goalStatus(goal: PersonalGoal, ctx: GoalContext): GoalStatus {
  const created = localDate(goal.createdAt);
  const daysLeft = goal.deadline ? daysBetween(ctx.today, goal.deadline) : null;
  const base = { goal, daysLeft };

  if (goal.kind === 'lift') {
    const lifts = [...(ctx.lifts.get(goal.exerciseId ?? '') ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    const targetValue = liftTarget(goal);
    const current = bestLiftValue(goal, lifts);
    const hit = lifts.find((l) => l.date >= created && (liftValue(goal, l) ?? -1) >= targetValue);
    const achievedOn = hit ? hit.date : current !== null && current >= targetValue ? created : null;
    const span = targetValue - goal.start;
    return {
      ...base,
      title: ctx.names.get(goal.exerciseId ?? '') ?? 'Exercice supprimé',
      unit: goal.target > 0 ? 'kg' : 'reps',
      startValue: goal.start,
      targetValue,
      current,
      ratio: achievedOn ? 1 : current === null || span <= 0 ? 0 : clamp01((current - goal.start) / span),
      achievedOn,
    };
  }

  if (goal.kind === 'bodyweight') {
    const weighIns = [...ctx.weighIns].sort((a, b) => a.date.localeCompare(b.date));
    const latest = weighIns[weighIns.length - 1] ?? null;
    const losing = goal.target < goal.start;
    const reached = (w: number) => (losing ? w <= goal.target : w >= goal.target);
    const hit = weighIns.find((w) => w.date >= created && reached(w.weightKg));
    const span = goal.start - goal.target;
    return {
      ...base,
      title: 'Poids de corps',
      unit: 'kg',
      startValue: goal.start,
      targetValue: goal.target,
      current: latest?.weightKg ?? null,
      ratio: hit ? 1 : latest === null || span === 0 ? 0 : clamp01((goal.start - latest.weightKg) / span),
      achievedOn: hit?.date ?? null,
    };
  }

  const since = ctx.sessions
    .filter((s) => s.startedAt >= goal.createdAt)
    .sort((a, b) => a.startedAt - b.startedAt);
  const hit = since[goal.target - 1];
  return {
    ...base,
    title: 'Séances',
    unit: 'sessions',
    startValue: 0,
    targetValue: goal.target,
    current: since.length,
    ratio: clamp01(since.length / Math.max(1, goal.target)),
    achievedOn: hit?.date ?? null,
  };
}

/** En cours d'abord (date limite la plus proche, puis les plus avancés), puis les atteints, du plus récent au plus ancien. */
export function sortGoalStatuses(statuses: GoalStatus[]): GoalStatus[] {
  return [...statuses].sort((a, b) => {
    if ((a.achievedOn === null) !== (b.achievedOn === null)) return a.achievedOn === null ? -1 : 1;
    if (a.achievedOn !== null && b.achievedOn !== null) return b.achievedOn.localeCompare(a.achievedOn);
    const da = a.goal.deadline ?? '9999-12-31';
    const dbb = b.goal.deadline ?? '9999-12-31';
    return da.localeCompare(dbb) || b.ratio - a.ratio || a.goal.createdAt - b.goal.createdAt;
  });
}

async function goalContext(now: number, database: AppDB, exerciseIds: ID[]): Promise<GoalContext> {
  const [sessions, weighIns, exercises] = await Promise.all([
    database.sessions.where('status').equals('done').toArray(),
    database.bodyweights.toArray(),
    database.exercises.toArray(),
  ]);
  const done = new Map(sessions.map((s) => [s.id, s]));
  const lifts = new Map<ID, { weight: number; reps: number; date: string }[]>();
  if (exerciseIds.length > 0) {
    const sets = await database.sets.where('exerciseId').anyOf(exerciseIds).toArray();
    for (const set of sets) {
      const session = done.get(set.sessionId);
      if (!session || !isCountedSet(set)) continue;
      const list = lifts.get(set.exerciseId) ?? [];
      list.push({ weight: set.weight, reps: set.reps, date: session.date });
      lifts.set(set.exerciseId, list);
    }
  }
  return {
    lifts,
    weighIns: weighIns.filter((w) => Number.isFinite(w.weightKg)),
    sessions: sessions.map((s) => ({ date: s.date, startedAt: s.startedAt })),
    names: new Map(exercises.map((e) => [e.id, e.name])),
    today: localDate(now),
  };
}

export async function getGoalStatuses(now: number = Date.now(), database: AppDB = db): Promise<GoalStatus[]> {
  const { personalGoals } = await getSettings(database);
  if (personalGoals.length === 0) return [];
  const exerciseIds = [...new Set(personalGoals.flatMap((g) => (g.exerciseId ? [g.exerciseId] : [])))];
  const ctx = await goalContext(now, database, exerciseIds);
  return sortGoalStatuses(personalGoals.map((goal) => goalStatus(goal, ctx)));
}

// ---------- Créer, modifier, supprimer ----------

export interface GoalInput {
  kind: PersonalGoalKind;
  exerciseId?: ID | null;
  /** Charge (kg), poids de corps (kg) ou nombre de séances. */
  target: number;
  /** Répétitions visées (objectif de charge). */
  reps?: number;
  deadline?: string | null;
  /** Poids de corps actuel, quand aucune pesée n'est enregistrée. */
  currentWeight?: number | null;
}

const kg = (value: number) => `${String(Math.round(value * 100) / 100).replace('.', ',')} kg`;

function checkTarget(kind: PersonalGoalKind, target: number, reps: number): void {
  if (!Number.isFinite(target)) throw new AppError('Indique une valeur à atteindre.');
  if (kind === 'lift') {
    const { min, max } = GOAL_LIMITS.weight;
    if (target < min || target > max) throw new AppError(`Indique une charge entre ${min} et ${max} kg.`);
    if (!Number.isInteger(reps) || reps < GOAL_LIMITS.reps.min || reps > GOAL_LIMITS.reps.max) {
      throw new AppError(`Indique entre ${GOAL_LIMITS.reps.min} et ${GOAL_LIMITS.reps.max} répétitions.`);
    }
    if (target === 0 && reps < 2) throw new AppError('Au poids du corps, vise au moins 2 répétitions.');
  } else if (kind === 'bodyweight') {
    if (target < BODYWEIGHT_LIMITS.min || target > BODYWEIGHT_LIMITS.max) {
      throw new AppError(`Indique un poids entre ${BODYWEIGHT_LIMITS.min} et ${BODYWEIGHT_LIMITS.max} kg.`);
    }
  } else if (!Number.isInteger(target) || target < GOAL_LIMITS.sessions.min || target > GOAL_LIMITS.sessions.max) {
    throw new AppError(`Indique entre ${GOAL_LIMITS.sessions.min} et ${GOAL_LIMITS.sessions.max} séances.`);
  }
}

function checkDeadline(deadline: string | null, today: string): void {
  if (deadline === null) return;
  if (!isValidDay(deadline)) throw new AppError('Cette date n’est pas valide.');
  if (deadline < today) throw new AppError('La date limite doit être aujourd’hui ou plus tard.');
}

export async function addPersonalGoal(input: GoalInput, now: number = Date.now(), database: AppDB = db): Promise<PersonalGoal> {
  const today = localDate(now);
  const reps = input.kind === 'lift' ? Math.round(input.reps ?? 1) : 1;
  const target = input.kind === 'bodyweight' ? Math.round(input.target * 10) / 10 : input.kind === 'lift' ? Math.round(input.target * 100) / 100 : Math.round(input.target);
  checkTarget(input.kind, target, reps);
  const deadline = input.deadline ?? null;
  checkDeadline(deadline, today);

  return database.transaction('rw', [database.settings, database.exercises, database.sets, database.sessions, database.bodyweights], async () => {
    const { personalGoals } = await getSettings(database);
    if (personalGoals.length >= MAX_PERSONAL_GOALS) {
      throw new AppError(`Tu as déjà ${MAX_PERSONAL_GOALS} objectifs : supprimes-en un d’abord.`);
    }

    let start = 0;
    let exerciseId: ID | null = null;
    if (input.kind === 'lift') {
      const exercise = input.exerciseId ? await database.exercises.get(input.exerciseId) : undefined;
      if (!exercise) throw new AppError('Choisis un exercice.');
      exerciseId = exercise.id;
      const ctx = await goalContext(now, database, [exercise.id]);
      const best = bestLiftValue({ target, reps }, ctx.lifts.get(exercise.id) ?? []);
      if (best !== null && best >= liftTarget({ target, reps })) {
        throw new AppError(
          target > 0
            ? `Déjà fait : ${kg(best)} pour ${reps} répétition${reps > 1 ? 's' : ''} ou plus. Vise plus haut !`
            : `Déjà fait : ${best} répétitions. Vise plus haut !`,
        );
      }
      start = best ?? 0;
    } else if (input.kind === 'bodyweight') {
      const weighIns = (await database.bodyweights.orderBy('date').toArray()).filter((w) => Number.isFinite(w.weightKg));
      const latest = weighIns[weighIns.length - 1]?.weightKg ?? input.currentWeight ?? null;
      if (latest === null || !Number.isFinite(latest)) throw new AppError('Indique ton poids actuel.');
      if (latest < BODYWEIGHT_LIMITS.min || latest > BODYWEIGHT_LIMITS.max) {
        throw new AppError(`Indique un poids actuel entre ${BODYWEIGHT_LIMITS.min} et ${BODYWEIGHT_LIMITS.max} kg.`);
      }
      if (Math.abs(latest - target) < 0.05) throw new AppError('Tu es déjà à ce poids.');
      start = Math.round(latest * 10) / 10;
    }

    const goal: PersonalGoal = { id: newId(), kind: input.kind, exerciseId, target, reps, start, deadline, createdAt: now };
    await setSetting('personalGoals', [...personalGoals, goal], database);
    return goal;
  });
}

/** Change la cible ou la date limite. Le point de départ ne bouge pas. */
export async function updatePersonalGoal(
  id: string,
  patch: { target?: number; reps?: number; deadline?: string | null },
  now: number = Date.now(),
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const { personalGoals } = await getSettings(database);
    const goal = personalGoals.find((g) => g.id === id);
    if (!goal) throw new AppError('Cet objectif n’existe plus.');
    const next: PersonalGoal = {
      ...goal,
      target: patch.target ?? goal.target,
      reps: goal.kind === 'lift' ? Math.round(patch.reps ?? goal.reps) : 1,
      deadline: patch.deadline === undefined ? goal.deadline : patch.deadline,
    };
    checkTarget(next.kind, next.target, next.reps);
    if (patch.deadline !== undefined) checkDeadline(next.deadline, localDate(now));
    await setSetting('personalGoals', personalGoals.map((g) => (g.id === id ? next : g)), database);
  });
}

export async function deletePersonalGoal(id: string, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const { personalGoals } = await getSettings(database);
    await setSetting('personalGoals', personalGoals.filter((g) => g.id !== id), database);
  });
}
