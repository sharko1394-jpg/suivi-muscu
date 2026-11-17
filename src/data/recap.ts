import { epley1RM, isCountedSet, type RecordKind } from './calc';
import { recentRecords } from './dashboard';
import { db, type AppDB } from './db';
import { getGoalStatuses, type GoalStatus } from './goals';
import { getSettings, setSetting } from './settings';
import type { ID, Muscle, Session, SessionExercise, SetEntry } from './types';
import { localDate } from './util';

// Bilans du mois et de l'année : tout est recalculé à partir de l'historique.

export type RecapKind = 'month' | 'year';

export interface RecapPeriod {
  kind: RecapKind;
  /** 'AAAA-MM' pour un mois, 'AAAA' pour une année. */
  key: string;
  year: number;
  /** 1 à 12 ; null pour une année. */
  month: number | null;
  /** Premier et dernier jour, inclus. */
  start: string;
  end: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Période d'après sa clé ('2026-10' ou '2026') ; null si la clé n'a pas de sens. */
export function recapPeriod(key: string): RecapPeriod | null {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 2000 || year > 2200) return null;
  if (match[2] === undefined) {
    return { kind: 'year', key, year, month: null, start: `${year}-01-01`, end: `${year}-12-31` };
  }
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(year, month, 0).getDate();
  return { kind: 'month', key, year, month, start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}` };
}

/** Mois ou année d'avant. */
export function previousRecapKey(period: RecapPeriod): string {
  if (period.kind === 'year') return String(period.year - 1);
  return period.month === 1 ? `${period.year - 1}-12` : `${period.year}-${pad(period.month! - 1)}`;
}

/** Mois ou année d'après. */
export function nextRecapKey(period: RecapPeriod): string {
  if (period.kind === 'year') return String(period.year + 1);
  return period.month === 12 ? `${period.year + 1}-01` : `${period.year}-${pad(period.month! + 1)}`;
}

export interface RecapTotals {
  sessions: number;
  /** Jours avec au moins une séance. */
  activeDays: number;
  durationSec: number;
  volume: number;
  /** Séries qui comptent. */
  sets: number;
  reps: number;
}

export interface RecapExercise {
  exerciseId: ID;
  name: string;
  sessions: number;
  sets: number;
  volume: number;
}

export interface RecapRecord {
  exerciseId: ID;
  exerciseName: string;
  weight: number;
  reps: number;
  kinds: RecordKind[];
  date: string;
}

export interface RecapProgress {
  exerciseId: ID;
  name: string;
  /** Meilleur 1RM estimé (kg) ou meilleures répétitions au poids du corps, avant la période… */
  before: number;
  /** …et pendant la période. */
  after: number;
  unit: 'kg' | 'reps';
  /** Gain relatif : 0,12 = +12 %. */
  gain: number;
}

export interface Recap {
  period: RecapPeriod;
  /** La période n'est pas finie. */
  inProgress: boolean;
  totals: RecapTotals;
  /** Mois (ou année) d'avant ; null si aucune séance avant cette période. */
  previous: RecapTotals | null;
  /** Jours avec séance, dans l'ordre. */
  days: string[];
  /** Séries qui ont battu un record. */
  recordCount: number;
  /** Le meilleur record de chaque exercice, le plus récent d'abord. */
  records: RecapRecord[];
  /** Exercices les plus travaillés (en séries). */
  exercises: RecapExercise[];
  muscles: { muscle: Muscle; sets: number }[];
  /** Plus gros progrès par rapport à avant la période. */
  progress: RecapProgress[];
  longest: { sessionId: ID; name: string; date: string; durationSec: number } | null;
  heaviest: { sessionId: ID; name: string; date: string; volume: number } | null;
  bodyweight: { from: number; to: number; fromDate: string; toDate: string } | null;
  /** Année : séances et volume de chaque mois. */
  months: { key: string; sessions: number; volume: number }[];
  /** Objectifs atteints pendant la période. */
  goals: { title: string; date: string }[];
}

export interface RecapInput {
  sessions: Session[];
  sessionExercises: SessionExercise[];
  sets: SetEntry[];
  bodyweights: { date: string; weightKg: number }[];
  /** Noms actuels des exercices. */
  names: Map<ID, string>;
  goals: GoalStatus[];
  today: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const durationOf = (s: Session) => Math.max(0, Math.round(((s.endedAt ?? s.startedAt) - s.startedAt) / 1000));

export function buildRecap(period: RecapPeriod, input: RecapInput): Recap {
  const done = input.sessions.filter((s) => s.status === 'done');
  const byId = new Map(done.map((s) => [s.id, s]));
  const counted = input.sets.filter((set) => byId.has(set.sessionId) && isCountedSet(set)) as (SetEntry & {
    weight: number;
    reps: number;
  })[];
  const dateOf = (set: SetEntry) => byId.get(set.sessionId)!.date;
  const inPeriod = (date: string, from = period.start, to = period.end) => date >= from && date <= to;
  const snapshots = new Map(input.sessionExercises.map((e) => [e.id, e]));
  const nameOf = (exerciseId: ID, sessionExerciseId?: ID) =>
    input.names.get(exerciseId) ?? (sessionExerciseId ? snapshots.get(sessionExerciseId)?.exerciseName : undefined) ?? 'Exercice';

  const totalsFor = (from: string, to: string): RecapTotals => {
    const sessions = done.filter((s) => inPeriod(s.date, from, to));
    const ids = new Set(sessions.map((s) => s.id));
    const sets = counted.filter((set) => ids.has(set.sessionId));
    return {
      sessions: sessions.length,
      activeDays: new Set(sessions.map((s) => s.date)).size,
      durationSec: sessions.reduce((sum, s) => sum + durationOf(s), 0),
      volume: round2(sets.reduce((sum, set) => sum + set.weight * set.reps, 0)),
      sets: sets.length,
      reps: sets.reduce((sum, set) => sum + set.reps, 0),
    };
  };

  const sessions = done.filter((s) => inPeriod(s.date)).sort((a, b) => a.startedAt - b.startedAt);
  const periodSets = counted.filter((set) => inPeriod(dateOf(set)));
  const previousPeriod = recapPeriod(previousRecapKey(period))!;
  const hasBefore = done.some((s) => s.date < period.start);

  // Exercices et muscles les plus travaillés.
  const exercises = new Map<ID, RecapExercise & { sessionIds: Set<ID> }>();
  const muscles = new Map<Muscle, number>();
  for (const set of periodSets) {
    const entry =
      exercises.get(set.exerciseId) ??
      { exerciseId: set.exerciseId, name: nameOf(set.exerciseId, set.sessionExerciseId), sessions: 0, sets: 0, volume: 0, sessionIds: new Set<ID>() };
    entry.sets++;
    entry.volume = round2(entry.volume + set.weight * set.reps);
    entry.sessionIds.add(set.sessionId);
    entry.sessions = entry.sessionIds.size;
    exercises.set(set.exerciseId, entry);
    const muscle = snapshots.get(set.sessionExerciseId)?.primaryMuscle;
    if (muscle) muscles.set(muscle, (muscles.get(muscle) ?? 0) + 1);
  }

  // Records battus pendant la période (mêmes règles que pendant la séance).
  const exerciseOfSet = new Map(input.sets.map((s) => [s.id, s.exerciseId]));
  const snapshotNames = new Map(input.sessionExercises.map((e) => [e.id, e.exerciseName]));
  const beaten = recentRecords(done, input.sets, snapshotNames, period.start).filter((r) => r.date <= period.end);
  const bestRecord = new Map<ID, RecapRecord>();
  for (const record of beaten) {
    const exerciseId = exerciseOfSet.get(record.setId) ?? '';
    const current = bestRecord.get(exerciseId);
    if (!current || record.weight > current.weight || (record.weight === current.weight && record.reps > current.reps)) {
      bestRecord.set(exerciseId, {
        exerciseId,
        exerciseName: input.names.get(exerciseId) ?? record.exerciseName,
        weight: record.weight,
        reps: record.reps,
        kinds: record.kinds,
        date: record.date,
      });
    }
  }

  // Progrès : meilleur 1RM estimé (ou répétitions au poids du corps) pendant la période, contre avant.
  const progress: RecapProgress[] = [];
  for (const exerciseId of exercises.keys()) {
    const during = periodSets.filter((s) => s.exerciseId === exerciseId);
    const before = counted.filter((s) => s.exerciseId === exerciseId && dateOf(s) < period.start);
    // Au poids du corps, la charge n'est que le lest : on suit les répétitions sans lest.
    const bodyweight = during.some((s) => snapshots.get(s.sessionExerciseId)?.equipment === 'poids-du-corps');
    const loaded = !bodyweight && during.some((s) => s.weight > 0);
    const metric = (list: typeof counted): number | null => {
      let best: number | null = null;
      for (const set of list) {
        const value = loaded ? epley1RM(set.weight, set.reps) : set.weight === 0 ? set.reps : null;
        if (value !== null && (best === null || value > best)) best = value;
      }
      return best;
    };
    const after = metric(during);
    const previous = metric(before);
    if (after === null || previous === null || previous <= 0 || after <= previous) continue;
    progress.push({
      exerciseId,
      name: exercises.get(exerciseId)!.name,
      before: previous,
      after,
      unit: loaded ? 'kg' : 'reps',
      gain: Math.round(((after - previous) / previous) * 1000) / 1000,
    });
  }
  progress.sort((a, b) => b.gain - a.gain);

  // Séance la plus longue et la plus lourde.
  let longest: Recap['longest'] = null;
  let heaviest: Recap['heaviest'] = null;
  for (const session of sessions) {
    const durationSec = durationOf(session);
    if (!longest || durationSec > longest.durationSec) {
      longest = { sessionId: session.id, name: session.workoutName, date: session.date, durationSec };
    }
    const volume = round2(
      periodSets.filter((s) => s.sessionId === session.id).reduce((sum, s) => sum + s.weight * s.reps, 0),
    );
    if (volume > 0 && (!heaviest || volume > heaviest.volume)) {
      heaviest = { sessionId: session.id, name: session.workoutName, date: session.date, volume };
    }
  }

  const weighIns = input.bodyweights
    .filter((w) => Number.isFinite(w.weightKg) && inPeriod(w.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstWeighIn = weighIns[0];
  const lastWeighIn = weighIns[weighIns.length - 1];

  const months =
    period.kind === 'year'
      ? Array.from({ length: 12 }, (_, index) => {
          const key = `${period.year}-${pad(index + 1)}`;
          const p = recapPeriod(key)!;
          const totals = totalsFor(p.start, p.end);
          return { key, sessions: totals.sessions, volume: totals.volume };
        })
      : [];

  return {
    period,
    inProgress: input.today <= period.end,
    totals: totalsFor(period.start, period.end),
    previous: hasBefore ? totalsFor(previousPeriod.start, previousPeriod.end) : null,
    days: [...new Set(sessions.map((s) => s.date))].sort(),
    recordCount: beaten.length,
    records: [...bestRecord.values()].sort((a, b) => b.date.localeCompare(a.date) || b.weight - a.weight),
    exercises: [...exercises.values()]
      .map(({ sessionIds: _ids, ...rest }) => rest)
      .sort((a, b) => b.sets - a.sets || b.sessions - a.sessions || a.name.localeCompare(b.name, 'fr')),
    muscles: [...muscles.entries()]
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle)),
    progress: progress.slice(0, 5),
    longest,
    heaviest,
    bodyweight:
      weighIns.length >= 2
        ? { from: firstWeighIn.weightKg, to: lastWeighIn.weightKg, fromDate: firstWeighIn.date, toDate: lastWeighIn.date }
        : null,
    months,
    goals: input.goals
      .filter((g) => g.achievedOn !== null && inPeriod(g.achievedOn))
      .map((g) => ({ title: g.title, date: g.achievedOn! }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function getRecap(key: string, now: number = Date.now(), database: AppDB = db): Promise<Recap | null> {
  const period = recapPeriod(key);
  if (!period) return null;
  const [sessions, sessionExercises, sets, bodyweights, exercises, goals] = await Promise.all([
    database.sessions.where('status').equals('done').toArray(),
    database.sessionExercises.toArray(),
    database.sets.toArray(),
    database.bodyweights.toArray(),
    database.exercises.toArray(),
    getGoalStatuses(now, database),
  ]);
  return buildRecap(period, {
    sessions,
    sessionExercises,
    sets,
    bodyweights,
    names: new Map(exercises.map((e) => [e.id, e.name])),
    goals,
    today: localDate(now),
  });
}

// ---------- Bilans à découvrir sur l'accueil ----------

/**
 * Bilans prêts et pas encore vus : celui du mois dernier dès le 1er du mois,
 * et celui de l'année passée pendant tout le mois de janvier. Seulement s'il y a eu des séances.
 */
export function pendingRecapKeys(input: { sessionDates: string[]; today: string; seen: { month: string | null; year: string | null } }): string[] {
  const { sessionDates, today, seen } = input;
  const thisMonth = recapPeriod(today.slice(0, 7))!;
  const lastMonth = previousRecapKey(thisMonth);
  const lastYear = String(thisMonth.year - 1);
  const keys: string[] = [];
  if (thisMonth.month === 1 && (seen.year ?? '') < lastYear && sessionDates.some((d) => d.startsWith(`${lastYear}-`))) {
    keys.push(lastYear);
  }
  if ((seen.month ?? '') < lastMonth && sessionDates.some((d) => d.startsWith(`${lastMonth}-`))) keys.push(lastMonth);
  return keys;
}

export async function getPendingRecaps(now: number = Date.now(), database: AppDB = db): Promise<string[]> {
  const [sessions, settings] = await Promise.all([
    database.sessions.where('status').equals('done').toArray(),
    getSettings(database),
  ]);
  return pendingRecapKeys({ sessionDates: sessions.map((s) => s.date), today: localDate(now), seen: settings.recapSeen });
}

/** Le bilan a été ouvert (ou écarté) : sa carte ne revient plus sur l'accueil. */
export async function markRecapSeen(key: string, database: AppDB = db): Promise<void> {
  const period = recapPeriod(key);
  if (!period) return;
  await database.transaction('rw', database.settings, async () => {
    const { recapSeen } = await getSettings(database);
    const next = { ...recapSeen };
    if (period.kind === 'year') {
      if ((next.year ?? '') >= key) return;
      next.year = key;
    } else {
      if ((next.month ?? '') >= key) return;
      next.month = key;
    }
    await setSetting('recapSeen', next, database);
  });
}
