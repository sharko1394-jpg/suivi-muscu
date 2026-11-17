import {
  addLift,
  emptyRecords,
  isCountedSet,
  recordsBeaten,
  type Lift,
  type RecordKind,
  type RunningRecords,
} from './calc';
import { db, type AppDB } from './db';
import { weekStart, weekStreaks } from './stats';
import type { ID, Muscle, Session, SetEntry } from './types';
import { DAY_MS, localDate } from './util';

// Données des widgets de l'accueil. Chaque widget ne lit que ce dont il a besoin.

// ---------- Cette semaine ----------

export interface WeekSummary {
  /** Du lundi au dimanche : jour, et séance faite ce jour-là ou non. */
  days: { date: string; done: boolean; today: boolean }[];
  /** Séances terminées cette semaine. */
  count: number;
  /** Semaines d'affilée avec au moins une séance. */
  streak: number;
}

export function weekSummary(sessionDates: string[], today: string): WeekSummary {
  const monday = weekStart(today);
  const [y, m, d] = monday.split('-').map(Number);
  const days = Array.from({ length: 7 }, (_, index) => {
    // Midi : un changement d'heure ne fait pas sauter de jour.
    const date = localDate(new Date(y, m - 1, d + index, 12).getTime());
    return { date, done: sessionDates.includes(date), today: date === today };
  });
  return {
    days,
    count: sessionDates.filter((date) => date >= monday && date <= days[6].date).length,
    streak: weekStreaks(sessionDates, today).current,
  };
}

export async function getWeekSummary(now: number = Date.now(), database: AppDB = db): Promise<WeekSummary> {
  const sessions = await database.sessions.where('status').equals('done').toArray();
  return weekSummary(
    sessions.map((s) => s.date),
    localDate(now),
  );
}

// ---------- Records récents ----------

export interface RecentRecord {
  setId: ID;
  sessionId: ID;
  exerciseName: string;
  weight: number;
  reps: number;
  kinds: RecordKind[];
  date: string;
}

/**
 * Records battus pendant les `days` derniers jours, du plus récent au plus ancien.
 * Mêmes règles que pendant la séance : séries qui comptent, faire strictement mieux,
 * et la première séance d'un exercice n'en bat aucun.
 */
export function recentRecords(
  sessions: Session[],
  sets: SetEntry[],
  names: Map<ID, string>,
  since: string,
): RecentRecord[] {
  const done = sessions.filter((s) => s.status === 'done').sort((a, b) => a.startedAt - b.startedAt);
  const bySession = new Map<ID, (SetEntry & Lift)[]>();
  for (const set of sets) {
    if (!isCountedSet(set)) continue;
    const list = bySession.get(set.sessionId);
    if (list) list.push(set);
    else bySession.set(set.sessionId, [set]);
  }

  const running = new Map<ID, RunningRecords>();
  const found: RecentRecord[] = [];
  for (const session of done) {
    const sessionSets = (bySession.get(session.id) ?? []).sort(
      (a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.order - b.order,
    );
    // Les records de la séance se comparent à ce qui précède la séance, puis série après série.
    const before = new Set(sessionSets.map((s) => s.exerciseId).filter((id) => running.has(id)));
    for (const set of sessionSets) {
      let records = running.get(set.exerciseId);
      if (!records) {
        records = emptyRecords();
        running.set(set.exerciseId, records);
      }
      if (before.has(set.exerciseId)) {
        const kinds = recordsBeaten(records, set);
        if (kinds.length > 0 && session.date >= since) {
          found.push({
            setId: set.id,
            sessionId: session.id,
            exerciseName: names.get(set.sessionExerciseId) ?? 'Exercice',
            weight: set.weight,
            reps: set.reps,
            kinds,
            date: session.date,
          });
        }
      }
      addLift(records, set);
    }
  }
  return found.reverse();
}

export async function getRecentRecords(
  now: number = Date.now(),
  days: number = 30,
  database: AppDB = db,
): Promise<RecentRecord[]> {
  const [sessions, sessionExercises, sets] = await Promise.all([
    database.sessions.where('status').equals('done').toArray(),
    database.sessionExercises.toArray(),
    database.sets.toArray(),
  ]);
  const names = new Map(sessionExercises.map((e) => [e.id, e.exerciseName]));
  return recentRecords(sessions, sets, names, localDate(now - days * DAY_MS));
}

// ---------- Poids de corps ----------

export interface BodyweightTrend {
  latest: { date: string; weightKg: number } | null;
  /** Écart avec la pesée d'il y a environ un mois (ou la plus ancienne), en kg. */
  change: number | null;
  /** Dernières pesées, de la plus ancienne à la plus récente, pour la petite courbe. */
  points: { date: string; weightKg: number }[];
}

export function bodyweightTrend(weights: { date: string; weightKg: number }[], today: string): BodyweightTrend {
  // Une pesée illisible (fichier abîmé) est ignorée plutôt que d'afficher « NaN ».
  const sorted = weights
    .filter((w) => Number.isFinite(w.weightKg))
    .sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1] ?? null;
  if (!latest) return { latest: null, change: null, points: [] };
  const [y, m, d] = today.split('-').map(Number);
  const monthAgo = localDate(new Date(y, m - 1, d - 30, 12).getTime());
  const reference = [...sorted].reverse().find((w) => w.date <= monthAgo) ?? sorted[0];
  return {
    latest,
    change: reference === latest ? null : Math.round((latest.weightKg - reference.weightKg) * 10) / 10,
    points: sorted.slice(-12),
  };
}

export async function getBodyweightTrend(now: number = Date.now(), database: AppDB = db): Promise<BodyweightTrend> {
  const weights = await database.bodyweights.toArray();
  return bodyweightTrend(weights, localDate(now));
}

// ---------- Séries de la semaine ----------

export interface WeekSets {
  muscles: { muscle: Muscle; sets: number }[];
  total: number;
}

/** Séries qui comptent cette semaine, par muscle principal. */
export async function getWeekSets(now: number = Date.now(), database: AppDB = db): Promise<WeekSets> {
  const monday = weekStart(localDate(now));
  const sessions = await database.sessions.where('date').aboveOrEqual(monday).toArray();
  const done = new Set(sessions.filter((s) => s.status === 'done').map((s) => s.id));
  if (done.size === 0) return { muscles: [], total: 0 };
  const [exercises, sets] = await Promise.all([
    database.sessionExercises.where('sessionId').anyOf([...done]).toArray(),
    database.sets.where('sessionId').anyOf([...done]).toArray(),
  ]);
  const muscleOf = new Map(exercises.map((e) => [e.id, e.primaryMuscle]));
  const counts = new Map<Muscle, number>();
  for (const set of sets) {
    const muscle = muscleOf.get(set.sessionExerciseId);
    if (muscle && isCountedSet(set)) counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
  }
  const muscles = [...counts.entries()]
    .map(([muscle, count]) => ({ muscle, sets: count }))
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
  return { muscles, total: muscles.reduce((sum, m) => sum + m.sets, 0) };
}
