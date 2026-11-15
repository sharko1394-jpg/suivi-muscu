import { db, type AppDB } from './db';
import { totalsOf, type SessionTotals } from './sessions';
import type { ID, Session, SetEntry } from './types';
import { AppError, localDate, newId } from './util';

// Historique : consulter, corriger ou supprimer les séances terminées.
// Ce fichier ne touche jamais au programme.

export interface HistoryEntry {
  session: Session;
  totals: SessionTotals;
  /** Noms des exercices, tels qu'ils étaient le jour de la séance. */
  exerciseNames: string[];
}

/** Toutes les séances terminées, de la plus récente à la plus ancienne. */
export async function listHistory(database: AppDB = db): Promise<HistoryEntry[]> {
  const [sessions, exercises, sets] = await Promise.all([
    database.sessions.where('status').equals('done').toArray(),
    database.sessionExercises.toArray(),
    database.sets.toArray(),
  ]);
  const setsBySession = new Map<ID, SetEntry[]>();
  for (const set of sets) {
    const list = setsBySession.get(set.sessionId);
    if (list) list.push(set);
    else setsBySession.set(set.sessionId, [set]);
  }
  return sessions
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((session) => ({
      session,
      totals: totalsOf(session, setsBySession.get(session.id) ?? []),
      exerciseNames: exercises
        .filter((e) => e.sessionId === session.id)
        .sort((a, b) => a.order - b.order)
        .map((e) => e.exerciseName),
    }));
}

async function requireDone(sessionId: ID, database: AppDB): Promise<Session> {
  const session = await database.sessions.get(sessionId);
  if (!session) throw new AppError('Cette séance n’existe plus.');
  if (session.status !== 'done') throw new AppError('Cette séance est encore en cours.');
  return session;
}

const historyTables = (database: AppDB) => [database.sessions, database.sessionExercises, database.sets];

/** Supprime définitivement une séance terminée, avec ses exercices et ses séries. */
export async function deleteSession(sessionId: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', historyTables(database), async () => {
    await requireDone(sessionId, database);
    await database.sets.where('sessionId').equals(sessionId).delete();
    await database.sessionExercises.where('sessionId').equals(sessionId).delete();
    await database.sessions.delete(sessionId);
  });
}

/** Correction : ajoute une série déjà validée, copiée sur la précédente. */
export async function addDoneSet(sessionExerciseId: ID, database: AppDB = db): Promise<SetEntry> {
  return database.transaction('rw', historyTables(database), async () => {
    const exercise = await database.sessionExercises.get(sessionExerciseId);
    if (!exercise) throw new AppError('Cet exercice n’est plus dans la séance.');
    const session = await requireDone(exercise.sessionId, database);
    const sets = await database.sets.where('sessionExerciseId').equals(sessionExerciseId).sortBy('order');
    const previous = sets[sets.length - 1];
    const t = Date.now();
    const set: SetEntry = {
      id: newId(),
      sessionId: session.id,
      sessionExerciseId,
      exerciseId: exercise.exerciseId,
      order: previous ? previous.order + 1 : 0,
      type: 'normal',
      weight: previous?.weight ?? 0,
      reps: previous?.reps ?? 10,
      rpe: null,
      done: true,
      completedAt: previous?.completedAt ?? session.startedAt,
      createdAt: t,
      updatedAt: t,
    };
    await database.sets.add(set);
    return set;
  });
}

/**
 * Correction : supprime une série d'une séance terminée.
 * Si c'était la dernière de l'exercice, l'exercice disparaît de la séance.
 * Une séance ne peut pas rester vide : dans ce cas, c'est la séance qu'il faut supprimer.
 */
export async function removeHistorySet(setId: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', historyTables(database), async () => {
    const set = await database.sets.get(setId);
    if (!set) throw new AppError('Cette série n’existe plus.');
    await requireDone(set.sessionId, database);
    const siblings = await database.sets
      .where('sessionExerciseId')
      .equals(set.sessionExerciseId)
      .sortBy('order');

    if (siblings.length > 1) {
      await database.sets.delete(setId);
      await Promise.all(
        siblings
          .filter((s) => s.id !== setId)
          .map((s, index) => database.sets.update(s.id, { order: index })),
      );
      return;
    }

    const exercises = await database.sessionExercises.where('sessionId').equals(set.sessionId).sortBy('order');
    if (exercises.length <= 1) {
      throw new AppError('C’est la dernière série de la séance : supprime plutôt la séance entière.');
    }
    await database.sets.delete(setId);
    await database.sessionExercises.delete(set.sessionExerciseId);
    await Promise.all(
      exercises
        .filter((e) => e.id !== set.sessionExerciseId)
        .map((e, index) => database.sessionExercises.update(e.id, { order: index })),
    );
  });
}

/** Correction : déplace une séance terminée à un autre jour, en gardant ses heures. */
export async function setSessionDate(
  sessionId: ID,
  date: string,
  now: number = Date.now(),
  database: AppDB = db,
): Promise<void> {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new AppError('Cette date n’est pas valide.');
  if (date > localDate(now)) throw new AppError('Une séance ne peut pas être dans le futur.');

  await database.transaction('rw', historyTables(database), async () => {
    const session = await requireDone(sessionId, database);
    const old = new Date(session.startedAt);
    const moved = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      old.getHours(),
      old.getMinutes(),
      old.getSeconds(),
      old.getMilliseconds(),
    ).getTime();
    if (localDate(moved) !== date) throw new AppError('Cette date n’est pas valide.');
    const shift = moved - session.startedAt;
    if (shift === 0) return;

    await database.sessions.update(sessionId, {
      startedAt: moved,
      endedAt: session.endedAt === null ? null : session.endedAt + shift,
      date,
      updatedAt: now,
    });
    await database.sets
      .where('sessionId')
      .equals(sessionId)
      .modify((set) => {
        if (set.completedAt !== null) set.completedAt += shift;
      });
  });
}

/**
 * Semaines d'un mois pour l'affichage en calendrier, du lundi au dimanche.
 * Chaque case est un jour 'AAAA-MM-JJ', ou null hors du mois.
 */
export function monthWeeks(year: number, monthIndex: number): (string | null)[][] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // 0 = lundi
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
