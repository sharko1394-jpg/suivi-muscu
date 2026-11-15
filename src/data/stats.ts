import { epley1RM, isCountedSet, type Lift } from './calc';
import { db, type AppDB } from './db';
import type { Bodyweight, ID, Muscle, Session, SetEntry } from './types';
import { AppError, DAY_MS, localDate, newId } from './util';

// Statistiques. Tout est recalculé à partir des séries enregistrées : rien n'est stocké,
// donc une correction dans l'historique se retrouve aussitôt ici.

// ---------- Périodes et semaines ----------

export type Period = '1m' | '3m' | '6m' | '1y' | 'all';

export const PERIODS: { value: Period; label: string; days: number | null }[] = [
  { value: '1m', label: '1 mois', days: 30 },
  { value: '3m', label: '3 mois', days: 91 },
  { value: '6m', label: '6 mois', days: 182 },
  { value: '1y', label: '1 an', days: 365 },
  { value: 'all', label: 'Tout', days: null },
];

/** Premier jour ('AAAA-MM-JJ') de la période, ou null pour « tout ». */
export function periodStart(period: Period, now: number = Date.now()): string | null {
  const days = PERIODS.find((p) => p.value === period)?.days ?? null;
  return days === null ? null : localDate(now - days * DAY_MS);
}

const toDate = (day: string) => new Date(`${day}T12:00:00`);

/** Lundi de la semaine d'un jour donné ('AAAA-MM-JJ'). La semaine commence le lundi. */
export function weekStart(day: string): string {
  const date = toDate(day);
  const sinceMonday = (date.getDay() + 6) % 7;
  return localDate(date.getTime() - sinceMonday * DAY_MS);
}

const addWeeks = (monday: string, weeks: number) => localDate(toDate(monday).getTime() + weeks * 7 * DAY_MS);

// ---------- Progression d'un exercice ----------

export interface ExercisePoint {
  date: string;
  sessionId: ID;
  /** Charge la plus lourde de la séance. */
  maxWeight: number;
  /** Meilleur 1RM estimé de la séance (null si aucune série ne permet de l'estimer). */
  e1rm: number | null;
  /** Volume de l'exercice dans la séance. */
  volume: number;
  /** Série au plus grand produit charge × répétitions (au poids du corps : le plus de répétitions). */
  bestSet: Lift;
}

/** Un point par séance terminée, dans l'ordre chronologique. */
export function exercisePoints(sets: SetEntry[], sessions: Map<ID, Session>): ExercisePoint[] {
  const bySession = new Map<ID, (SetEntry & Lift)[]>();
  for (const set of sets) {
    if (!isCountedSet(set) || sessions.get(set.sessionId)?.status !== 'done') continue;
    const list = bySession.get(set.sessionId);
    if (list) list.push(set);
    else bySession.set(set.sessionId, [set]);
  }
  return [...bySession.entries()]
    .map(([sessionId, lifts]) => {
      const session = sessions.get(sessionId)!;
      let bestSet: Lift = lifts[0];
      let e1rm: number | null = null;
      for (const lift of lifts) {
        const estimate = epley1RM(lift.weight, lift.reps);
        if (estimate !== null && (e1rm === null || estimate > e1rm)) e1rm = estimate;
        const score = lift.weight * lift.reps;
        const bestScore = bestSet.weight * bestSet.reps;
        if (score > bestScore || (score === bestScore && lift.reps > bestSet.reps)) bestSet = lift;
      }
      return {
        date: session.date,
        startedAt: session.startedAt,
        sessionId,
        maxWeight: Math.max(...lifts.map((l) => l.weight)),
        e1rm,
        volume: Math.round(lifts.reduce((sum, l) => sum + l.weight * l.reps, 0) * 100) / 100,
        bestSet: { weight: bestSet.weight, reps: bestSet.reps },
      };
    })
    .sort((a, b) => a.startedAt - b.startedAt)
    .map(({ startedAt: _startedAt, ...point }) => point);
}

// ---------- Tableau des records ----------

export const REP_TARGETS = [1, 3, 5, 8, 10] as const;

export interface RepMax {
  reps: number;
  /** Meilleure charge soulevée au moins `reps` fois ; null si jamais fait. */
  weight: number | null;
  /** Jour où cette charge a été atteinte pour la première fois. */
  date: string | null;
}

/** Meilleure charge pour au moins 1, 3, 5, 8 et 10 répétitions (80 kg × 9 compte pour 8). */
export function repMaxTable(lifts: (Lift & { date: string })[]): RepMax[] {
  return REP_TARGETS.map((reps) => {
    let best: (Lift & { date: string }) | null = null;
    for (const lift of lifts) {
      if (lift.reps < reps) continue;
      if (
        best === null ||
        lift.weight > best.weight ||
        (lift.weight === best.weight && lift.date < best.date)
      ) {
        best = lift;
      }
    }
    return { reps, weight: best?.weight ?? null, date: best?.date ?? null };
  });
}

export interface ExerciseStats {
  points: ExercisePoint[];
  repMax: RepMax[];
}

export async function getExerciseStats(exerciseId: ID, database: AppDB = db): Promise<ExerciseStats> {
  const sets = await database.sets.where('exerciseId').equals(exerciseId).toArray();
  const sessionList = await database.sessions.bulkGet([...new Set(sets.map((s) => s.sessionId))]);
  const sessions = new Map<ID, Session>();
  for (const session of sessionList) if (session) sessions.set(session.id, session);
  const lifts = sets
    .filter(isCountedSet)
    .filter((s) => sessions.get(s.sessionId)?.status === 'done')
    .map((s) => ({ weight: s.weight, reps: s.reps, date: sessions.get(s.sessionId)!.date }));
  return { points: exercisePoints(sets, sessions), repMax: repMaxTable(lifts) };
}

export interface TrackedExercise {
  exerciseId: ID;
  name: string;
  sessionCount: number;
  lastDate: string;
}

/** Exercices ayant au moins une série qui compte, le plus récemment pratiqué en premier. */
export async function listTrackedExercises(database: AppDB = db): Promise<TrackedExercise[]> {
  const [sessions, sessionExercises, sets, library] = await Promise.all([
    database.sessions.where('status').equals('done').toArray(),
    database.sessionExercises.toArray(),
    database.sets.toArray(),
    database.exercises.toArray(),
  ]);
  const done = new Map(sessions.map((s) => [s.id, s]));
  const names = new Map(library.map((e) => [e.id, e.name]));
  const snapshots = new Map(sessionExercises.map((e) => [e.exerciseId, e.exerciseName]));
  const tracked = new Map<ID, { sessions: Set<ID>; lastDate: string }>();
  for (const set of sets) {
    const session = done.get(set.sessionId);
    if (!session || !isCountedSet(set)) continue;
    const entry = tracked.get(set.exerciseId) ?? { sessions: new Set<ID>(), lastDate: session.date };
    entry.sessions.add(session.id);
    if (session.date > entry.lastDate) entry.lastDate = session.date;
    tracked.set(set.exerciseId, entry);
  }
  return [...tracked.entries()]
    .map(([exerciseId, entry]) => ({
      exerciseId,
      // Nom actuel de l'exercice ; s'il a disparu de la bibliothèque, celui noté le jour de la séance.
      name: names.get(exerciseId) ?? snapshots.get(exerciseId) ?? 'Exercice supprimé',
      sessionCount: entry.sessions.size,
      lastDate: entry.lastDate,
    }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name, 'fr'));
}

// ---------- Assiduité ----------

export interface WeekCount {
  /** Lundi de la semaine. */
  week: string;
  count: number;
}

/** Nombre de séances par semaine sur les `weeks` dernières semaines, la plus ancienne d'abord. */
export function weeklyAttendance(sessionDates: string[], today: string, weeks: number = 12): WeekCount[] {
  const counts = new Map<string, number>();
  for (const date of sessionDates) {
    const week = weekStart(date);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, index) => {
    const week = addWeeks(current, index - (weeks - 1));
    return { week, count: counts.get(week) ?? 0 };
  });
}

/**
 * Séries de semaines consécutives avec au moins une séance.
 * La semaine en cours ne casse pas la série tant qu'elle n'est pas finie.
 */
export function weekStreaks(sessionDates: string[], today: string): { current: number; best: number } {
  const weeks = [...new Set(sessionDates.map(weekStart))].sort();
  if (weeks.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < weeks.length; i++) {
    run = weeks[i] === addWeeks(weeks[i - 1], 1) ? run + 1 : 1;
    if (run > best) best = run;
  }

  const active = new Set(weeks);
  let cursor = weekStart(today);
  if (!active.has(cursor)) cursor = addWeeks(cursor, -1);
  let current = 0;
  while (active.has(cursor)) {
    current++;
    cursor = addWeeks(cursor, -1);
  }
  return { current, best };
}

// ---------- Séries par groupe musculaire ----------

export interface MuscleWeek {
  week: string;
  /** Groupes musculaires travaillés cette semaine, du plus au moins sollicité. */
  muscles: { muscle: Muscle; sets: number }[];
  total: number;
}

/** Compte les séries par muscle principal et par semaine. */
export function muscleSetsByWeek(rows: { date: string; muscle: Muscle }[]): Map<string, MuscleWeek> {
  const weeks = new Map<string, Map<Muscle, number>>();
  for (const row of rows) {
    const week = weekStart(row.date);
    const counts = weeks.get(week) ?? new Map<Muscle, number>();
    counts.set(row.muscle, (counts.get(row.muscle) ?? 0) + 1);
    weeks.set(week, counts);
  }
  const result = new Map<string, MuscleWeek>();
  for (const [week, counts] of weeks) {
    const muscles = [...counts.entries()]
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
    result.set(week, { week, muscles, total: muscles.reduce((sum, m) => sum + m.sets, 0) });
  }
  return result;
}

export interface GeneralStats {
  totalSessions: number;
  attendance: WeekCount[];
  streaks: { current: number; best: number };
  /** Semaines ayant au moins une série, la plus récente d'abord. */
  muscleWeeks: MuscleWeek[];
}

export async function getGeneralStats(now: number = Date.now(), database: AppDB = db): Promise<GeneralStats> {
  const [sessions, sessionExercises, sets] = await Promise.all([
    database.sessions.where('status').equals('done').toArray(),
    database.sessionExercises.toArray(),
    database.sets.toArray(),
  ]);
  const done = new Map(sessions.map((s) => [s.id, s]));
  const muscleOf = new Map(sessionExercises.map((e) => [e.id, e.primaryMuscle]));
  const rows: { date: string; muscle: Muscle }[] = [];
  for (const set of sets) {
    const session = done.get(set.sessionId);
    const muscle = muscleOf.get(set.sessionExerciseId);
    if (session && muscle && isCountedSet(set)) rows.push({ date: session.date, muscle });
  }
  const dates = sessions.map((s) => s.date);
  const today = localDate(now);
  return {
    totalSessions: sessions.length,
    attendance: weeklyAttendance(dates, today),
    streaks: weekStreaks(dates, today),
    muscleWeeks: [...muscleSetsByWeek(rows).values()].sort((a, b) => b.week.localeCompare(a.week)),
  };
}

// ---------- Poids de corps ----------

export const BODYWEIGHT_LIMITS = { min: 20, max: 400 } as const;

/** Pesées, de la plus ancienne à la plus récente. */
export function listBodyweights(database: AppDB = db): Promise<Bodyweight[]> {
  return database.bodyweights.orderBy('date').toArray();
}

/** Enregistre la pesée d'un jour. Une seule pesée par jour : la nouvelle remplace l'ancienne. */
export async function saveBodyweight(
  date: string,
  weightKg: number,
  now: number = Date.now(),
  database: AppDB = db,
): Promise<Bodyweight> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || localDate(toDate(date).getTime()) !== date) {
    throw new AppError('Cette date n’est pas valide.');
  }
  if (date > localDate(now)) throw new AppError('Une pesée ne peut pas être dans le futur.');
  const { min, max } = BODYWEIGHT_LIMITS;
  if (!Number.isFinite(weightKg) || weightKg < min || weightKg > max) {
    throw new AppError(`Indique un poids entre ${min} et ${max} kg.`);
  }
  const rounded = Math.round(weightKg * 10) / 10;
  return database.transaction('rw', database.bodyweights, async () => {
    const existing = await database.bodyweights.where('date').equals(date).first();
    const entry: Bodyweight = existing
      ? { ...existing, weightKg: rounded, updatedAt: now }
      : { id: newId(), date, weightKg: rounded, createdAt: now, updatedAt: now };
    await database.bodyweights.put(entry);
    return entry;
  });
}

export async function deleteBodyweight(id: ID, database: AppDB = db): Promise<void> {
  await database.bodyweights.delete(id);
}
