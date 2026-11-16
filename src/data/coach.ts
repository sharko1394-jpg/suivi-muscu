import { epley1RM, isCountedSet, totalVolume } from './calc';
import { db, type AppDB } from './db';
import { getActiveProgram, listWorkouts } from './programs';
import { getSettings, type Goal } from './settings';
import { exercisePoints, repMaxTable, type ExercisePoint, type RepMax } from './stats';
import type { Equipment, ID, Muscle, PlannedExercise, Session, SetEntry, SetType } from './types';
import { DAY_MS, localDate } from './util';

// Conseils : analyse des séances terminées. Tout est recalculé, rien n'est stocké.
// Calculs purs d'abord (testables), puis `getCoachReport` qui lit la base.

// ---------- Objectifs ----------

export interface GoalProfile {
  label: string;
  /** Fourchette de répétitions conseillée quand le programme n'en fixe pas. */
  repMin: number;
  repMax: number;
  /** Séries par muscle et par semaine conseillées. */
  weeklySets: [number, number];
}

export const GOALS: Record<Goal, GoalProfile> = {
  force: { label: 'Force', repMin: 3, repMax: 6, weeklySets: [6, 12] },
  muscle: { label: 'Muscle', repMin: 8, repMax: 12, weeklySets: [10, 20] },
  endurance: { label: 'Endurance', repMin: 15, repMax: 20, weeklySets: [8, 16] },
};

/** Arrondi vers le bas au pas de charge (2 décimales pour éviter 82.49999). */
export function floorToStep(weight: number, step: number): number {
  return Math.round(Math.floor(weight / step + 1e-9) * step * 100) / 100;
}

// ---------- Conseil de charge ----------

/** Séries de travail d'une séance pour un exercice (ni échauffement, ni drop set). */
export interface WorkSession {
  date: string;
  sets: { weight: number; reps: number; rpe: number | null }[];
}

export type LoadStatus = 'up' | 'almost' | 'keep' | 'down' | 'plateau';

export interface LoadAdvice {
  status: LoadStatus;
  /** Charge de travail de la dernière séance (la plus lourde). */
  weight: number;
  /** Répétitions faites à cette charge, dans l'ordre. */
  reps: number[];
  date: string;
  /** Charge conseillée pour la prochaine fois ; null = garder la même. */
  suggested: number | null;
  /** Grosse marge : la fourchette est dépassée de loin. */
  bigJump: boolean;
}

const WORK_TYPES: SetType[] = ['normal', 'failure', 'superset', 'biset'];

const topSets = (session: WorkSession) => {
  const top = Math.max(...session.sets.map((s) => s.weight));
  return { top, sets: session.sets.filter((s) => s.weight === top) };
};

/** Score d'une séance pour repérer une stagnation : 1RM estimé, ou répétitions au poids du corps. */
function sessionScore(session: WorkSession): number {
  let best = 0;
  for (const set of session.sets) {
    best = Math.max(best, epley1RM(set.weight, set.reps) ?? (set.weight === 0 ? set.reps : 0));
  }
  return best;
}

/**
 * Double progression : on monte la charge quand toutes les séries de travail atteignent le haut
 * de la fourchette ; on la baisse quand on reste nettement sous le bas de la fourchette.
 * `sessions` est dans l'ordre chronologique.
 */
export function loadAdvice(input: {
  sessions: WorkSession[];
  repMin: number;
  repMax: number;
  step: number;
}): LoadAdvice | null {
  const sessions = input.sessions.filter((s) => s.sets.length > 0);
  const last = sessions[sessions.length - 1];
  if (!last) return null;
  const { repMin, repMax, step } = input;
  const { top, sets } = topSets(last);
  const reps = sets.map((s) => s.reps);
  const base = { weight: top, reps, date: last.date, bigJump: false };

  const atMax = reps.filter((r) => r >= repMax).length;
  const belowMin = reps.filter((r) => r < repMin).length;
  const rpes = sets.map((s) => s.rpe).filter((r): r is number => r !== null);
  const easy = rpes.length > 0 && rpes.reduce((a, b) => a + b, 0) / rpes.length <= 7;

  // Monter : toutes les séries au plafond (ou presque toutes, et c'était facile).
  if (atMax === reps.length || (atMax >= Math.ceil(reps.length / 2) && easy)) {
    const bigJump = reps.every((r) => r >= repMax + 3);
    return { ...base, status: 'up', suggested: Math.round((top + step * (bigJump ? 2 : 1)) * 100) / 100, bigJump };
  }

  // Baisser : nettement sous la fourchette, deux séances de suite à cette charge (ou très loin dessous).
  const deload = top > 0 ? Math.max(step, floorToStep(top * 0.9, step)) : null;
  if (belowMin > reps.length / 2) {
    const previous = sessions[sessions.length - 2];
    const sorted = [...reps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const previousAlsoLow =
      previous !== undefined &&
      topSets(previous).top === top &&
      topSets(previous).sets.filter((s) => s.reps < repMin).length > topSets(previous).sets.length / 2;
    if (previousAlsoLow || median < repMin - 2) {
      // Retour à la dernière charge plus légère qui était réussie, si elle n'est pas trop loin ; sinon −10 %.
      const lastGood = [...sessions]
        .reverse()
        .map(topSets)
        .find((s) => s.top < top && s.sets.filter((set) => set.reps >= repMin).length > s.sets.length / 2);
      const back = lastGood && lastGood.top >= top * 0.8 ? lastGood.top : deload;
      return { ...base, status: 'down', suggested: back };
    }
    return { ...base, status: 'keep', suggested: null };
  }

  // Stagnation : le meilleur résultat date d'au moins 3 séances, sans progrès depuis.
  if (sessions.length >= 4) {
    const scores = sessions.map(sessionScore);
    const bestBefore = Math.max(...scores.slice(0, -3));
    const recentBest = Math.max(...scores.slice(-3));
    if (recentBest <= bestBefore) return { ...base, status: 'plateau', suggested: deload };
  }

  if (atMax >= Math.ceil(reps.length / 2)) return { ...base, status: 'almost', suggested: null };
  return { ...base, status: 'keep', suggested: null };
}

// ---------- Répartition du volume ----------

export const MAJOR_MUSCLES: Muscle[] = [
  'pectoraux',
  'dos',
  'epaules',
  'biceps',
  'triceps',
  'quadriceps',
  'ischios',
  'fessiers',
  'mollets',
  'abdominaux',
];

const PUSH: Muscle[] = ['pectoraux', 'epaules', 'triceps'];
const PULL: Muscle[] = ['dos', 'biceps', 'trapezes'];
const LOWER: Muscle[] = ['quadriceps', 'ischios', 'fessiers', 'mollets', 'adducteurs', 'abducteurs'];

export interface MuscleVolume {
  muscle: Muscle;
  /** Séries par semaine (muscle principal = 1, secondaire = ½), en moyenne. */
  perWeek: number;
  status: 'low' | 'ok' | 'high';
}

export type BalanceAlert = 'more-push' | 'more-pull' | 'legs-low' | 'quads-over-hams';

export interface VolumeReport {
  weeks: number;
  muscles: MuscleVolume[];
  /** Grands groupes musculaires pas travaillés du tout sur la période. */
  neglected: Muscle[];
  alerts: BalanceAlert[];
  target: [number, number];
}

/**
 * Séries par muscle et par semaine sur les 4 dernières semaines (ou depuis la première séance).
 * Un muscle secondaire compte pour une demi-série.
 */
export function volumeReport(input: {
  rows: { date: string; primary: Muscle; secondary: Muscle[] }[];
  today: string;
  firstDate: string | null;
  goal: Goal;
}): VolumeReport {
  const target = GOALS[input.goal].weeklySets;
  const todayMs = new Date(`${input.today}T12:00:00`).getTime();
  const from = localDate(todayMs - 27 * DAY_MS);
  const sinceFirst = input.firstDate
    ? Math.ceil((todayMs - new Date(`${input.firstDate}T12:00:00`).getTime() + DAY_MS) / (7 * DAY_MS))
    : 4;
  const weeks = Math.min(4, Math.max(1, sinceFirst));

  const sets = new Map<Muscle, number>();
  for (const row of input.rows) {
    if (row.date < from || row.date > input.today) continue;
    sets.set(row.primary, (sets.get(row.primary) ?? 0) + 1);
    for (const m of row.secondary) sets.set(m, (sets.get(m) ?? 0) + 0.5);
  }
  const perWeek = (m: Muscle) => Math.round(((sets.get(m) ?? 0) / weeks) * 10) / 10;

  const muscles = [...sets.keys()]
    .map((muscle) => {
      const value = perWeek(muscle);
      return {
        muscle,
        perWeek: value,
        status: value < target[0] ? 'low' : value > target[1] ? 'high' : 'ok',
      } as MuscleVolume;
    })
    .sort((a, b) => b.perWeek - a.perWeek || a.muscle.localeCompare(b.muscle));

  const sum = (group: Muscle[]) => group.reduce((n, m) => n + perWeek(m), 0);
  const push = sum(PUSH);
  const pull = sum(PULL);
  const lower = sum(LOWER);
  const upper = push + pull;
  const alerts: BalanceAlert[] = [];
  if (push + pull >= 6) {
    if (push > pull * 1.4) alerts.push('more-push');
    else if (pull > push * 1.4) alerts.push('more-pull');
  }
  if (upper >= 10 && lower < upper * 0.4) alerts.push('legs-low');
  if (perWeek('quadriceps') >= 4 && perWeek('quadriceps') > perWeek('ischios') * 2) {
    alerts.push('quads-over-hams');
  }

  return {
    weeks,
    muscles,
    neglected: input.rows.length === 0 ? [] : MAJOR_MUSCLES.filter((m) => !sets.has(m)),
    alerts,
    target,
  };
}

// ---------- Records à venir ----------

export interface PrForecast {
  /** Record à portée dès maintenant, d'après le niveau des dernières séances. */
  candidate: { reps: number; weight: number; record: RepMax } | null;
  /** Au rythme actuel, date à laquelle le 1RM estimé atteint un nouveau palier. */
  projection: { milestone: number; date: string; perWeek: number } | null;
}

/**
 * Records à venir pour un exercice.
 * - candidat : le 1RM estimé récent permet de battre le record à N répétitions
 *   (N pris dans la fourchette travaillée, pour rester réaliste) ;
 * - projection : tendance du 1RM estimé sur 8 semaines, prolongée jusqu'au prochain palier de 5 kg.
 */
export function prForecast(input: {
  points: ExercisePoint[];
  repMax: RepMax[];
  repMin: number;
  repMax_: number;
  step: number;
  today: string;
}): PrForecast {
  const todayMs = new Date(`${input.today}T12:00:00`).getTime();
  const dayOf = (date: string) => (new Date(`${date}T12:00:00`).getTime() - todayMs) / DAY_MS;
  const withE1rm = input.points.filter((p): p is ExercisePoint & { e1rm: number } => p.e1rm !== null);

  // Candidat.
  let candidate: PrForecast['candidate'] = null;
  const recent = withE1rm.filter((p) => dayOf(p.date) >= -42);
  if (recent.length > 0) {
    const level = Math.max(...recent.map((p) => p.e1rm));
    for (const record of input.repMax) {
      if (record.weight === null || record.weight === 0) continue;
      if (record.reps < input.repMin - 2 || record.reps > input.repMax_ + 2) continue;
      const weight = floorToStep(level / (1 + record.reps / 30), input.step);
      if (weight <= record.weight) continue;
      const gain = (weight - record.weight) / record.weight;
      const best = candidate ? (candidate.weight - candidate.record.weight!) / candidate.record.weight! : -1;
      if (gain > best) candidate = { reps: record.reps, weight, record };
    }
  }

  // Projection : régression linéaire du 1RM estimé sur les 8 dernières semaines.
  let projection: PrForecast['projection'] = null;
  const window = withE1rm.filter((p) => dayOf(p.date) >= -56);
  if (window.length >= 3) {
    const xs = window.map((p) => dayOf(p.date));
    const ys = window.map((p) => p.e1rm);
    const span = Math.max(...xs) - Math.min(...xs);
    if (span >= 14) {
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      let num = 0;
      let den = 0;
      xs.forEach((x, i) => {
        num += (x - mx) * (ys[i] - my);
        den += (x - mx) ** 2;
      });
      const slope = den === 0 ? 0 : num / den; // kg par jour
      const now = my + slope * (0 - mx);
      const perWeek = slope * 7;
      const best = Math.max(...withE1rm.map((p) => p.e1rm), now);
      const milestone = (Math.floor(best / 5) + 1) * 5;
      const weeks = perWeek > 0 ? (milestone - now) / perWeek : Infinity;
      if (perWeek >= 0.1 && weeks <= 16) {
        projection = {
          milestone,
          date: localDate(todayMs + Math.max(1, Math.round(weeks * 7)) * DAY_MS),
          perWeek: Math.round(perWeek * 10) / 10,
        };
      }
    }
  }

  return { candidate, projection };
}

// ---------- Rapport complet ----------

export interface ExerciseCoaching {
  exerciseId: ID;
  name: string;
  equipment: Equipment;
  repMin: number;
  repMax: number;
  /** La fourchette vient du programme actif (sinon : de l'objectif). */
  fromProgram: boolean;
  advice: LoadAdvice;
  forecast: PrForecast;
}

export interface CoachReport {
  goal: Goal;
  /** Séances terminées au total. */
  totalSessions: number;
  sessionsPerWeek: number;
  /** Volume des 4 dernières semaines comparé aux 4 précédentes, en % ; null sans point de comparaison. */
  volumeChange: number | null;
  exercises: ExerciseCoaching[];
  volume: VolumeReport;
}

const STATUS_ORDER: Record<LoadStatus, number> = { up: 0, down: 1, plateau: 2, almost: 3, keep: 4 };

export async function getCoachReport(now: number = Date.now(), database: AppDB = db): Promise<CoachReport> {
  const [settings, sessionList, sessionExercises, sets, library] = await Promise.all([
    getSettings(database),
    database.sessions.where('status').equals('done').toArray(),
    database.sessionExercises.toArray(),
    database.sets.toArray(),
    database.exercises.toArray(),
  ]);
  const program = await getActiveProgram(database);
  const workouts = program ? await listWorkouts(program.id, database) : [];
  const goal = settings.goal;
  const today = localDate(now);

  const planned = new Map<ID, PlannedExercise>();
  for (const workout of workouts) {
    for (const item of workout.items) if (!planned.has(item.exerciseId)) planned.set(item.exerciseId, item);
  }
  const sessions = new Map<ID, Session>(sessionList.map((s) => [s.id, s]));
  const snapshots = new Map(sessionExercises.map((e) => [e.id, e]));
  const libraryById = new Map(library.map((e) => [e.id, e]));
  const counted = sets.filter((s) => sessions.has(s.sessionId) && isCountedSet(s));

  // Bilan général.
  const todayMs = new Date(`${today}T12:00:00`).getTime();
  const daysAgo = (date: string) => Math.round((todayMs - new Date(`${date}T12:00:00`).getTime()) / DAY_MS);
  const dates = sessionList.map((s) => s.date).sort();
  const firstDate = dates[0] ?? null;
  const weeksCovered = firstDate ? Math.min(4, Math.max(1, Math.ceil((daysAgo(firstDate) + 1) / 7))) : 1;
  const recentSessions = sessionList.filter((s) => daysAgo(s.date) <= 27).length;
  const volumeIn = (from: number, to: number) =>
    totalVolume(counted.filter((s) => {
      const d = daysAgo(sessions.get(s.sessionId)!.date);
      return d >= from && d <= to;
    }));
  const volumeNow = volumeIn(0, 27);
  const volumeBefore = volumeIn(28, 55);

  // Volume par muscle.
  const rows = counted.flatMap((set) => {
    const exercise = snapshots.get(set.sessionExerciseId);
    return exercise
      ? [{ date: sessions.get(set.sessionId)!.date, primary: exercise.primaryMuscle, secondary: exercise.secondaryMuscles }]
      : [];
  });

  // Conseils par exercice pratiqué dans les 8 dernières semaines.
  const byExercise = new Map<ID, SetEntry[]>();
  for (const set of sets) {
    if (!sessions.has(set.sessionId)) continue;
    const list = byExercise.get(set.exerciseId);
    if (list) list.push(set);
    else byExercise.set(set.exerciseId, [set]);
  }

  const exercises: ExerciseCoaching[] = [];
  for (const [exerciseId, exerciseSets] of byExercise) {
    const work = exerciseSets.filter((s) => isCountedSet(s) && WORK_TYPES.includes(s.type));
    const bySession = new Map<ID, WorkSession>();
    for (const set of work) {
      const session = sessions.get(set.sessionId)!;
      const entry = bySession.get(session.id) ?? { date: session.date, sets: [] };
      entry.sets.push({ weight: set.weight!, reps: set.reps!, rpe: set.rpe });
      bySession.set(session.id, entry);
    }
    const ordered = [...bySession.entries()]
      .sort(([a], [b]) => sessions.get(a)!.startedAt - sessions.get(b)!.startedAt)
      .map(([, value]) => value);
    const last = ordered[ordered.length - 1];
    if (!last || daysAgo(last.date) > 56) continue;

    const item = planned.get(exerciseId);
    const snapshot = exerciseSets.map((s) => snapshots.get(s.sessionExerciseId)).find(Boolean);
    const known = libraryById.get(exerciseId);
    const repMin = item?.repMin ?? GOALS[goal].repMin;
    const repMax = item?.repMax ?? GOALS[goal].repMax;
    const step = known?.weightStep ?? settings.weightStep;
    const advice = loadAdvice({ sessions: ordered, repMin, repMax, step });
    if (!advice) continue;

    const lifts = exerciseSets
      .filter(isCountedSet)
      .map((s) => ({ weight: s.weight, reps: s.reps, date: sessions.get(s.sessionId)!.date }));
    exercises.push({
      exerciseId,
      name: known?.name ?? snapshot?.exerciseName ?? 'Exercice supprimé',
      equipment: known?.equipment ?? snapshot?.equipment ?? 'autre',
      repMin,
      repMax,
      fromProgram: item !== undefined,
      advice,
      forecast: prForecast({
        points: exercisePoints(exerciseSets, sessions),
        repMax: repMaxTable(lifts),
        repMin,
        repMax_: repMax,
        step,
        today,
      }),
    });
  }
  exercises.sort(
    (a, b) =>
      STATUS_ORDER[a.advice.status] - STATUS_ORDER[b.advice.status] ||
      b.advice.date.localeCompare(a.advice.date) ||
      a.name.localeCompare(b.name, 'fr'),
  );

  return {
    goal,
    totalSessions: sessionList.length,
    sessionsPerWeek: Math.round((recentSessions / weeksCovered) * 10) / 10,
    volumeChange: volumeBefore > 0 ? Math.round(((volumeNow - volumeBefore) / volumeBefore) * 100) : null,
    exercises,
    volume: volumeReport({ rows, today, firstDate, goal }),
  };
}
