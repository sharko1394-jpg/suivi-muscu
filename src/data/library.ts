import { epley1RM, isCountedSet } from './calc';
import { db, type AppDB } from './db';
import type { Exercise, ID, Session, SetEntry } from './types';

// Bibliothèque : tous les exercices, avec ce que l'historique en dit, pour les trier.

export type LibrarySort = 'frequent' | 'strongest' | 'progress' | 'recent' | 'name';

export const LIBRARY_SORTS: { value: LibrarySort; label: string }[] = [
  { value: 'frequent', label: 'Les plus faits' },
  { value: 'strongest', label: 'Les plus forts' },
  { value: 'progress', label: 'Plus de progrès' },
  { value: 'recent', label: 'Récents' },
  { value: 'name', label: 'A → Z' },
];

export interface LibraryEntry {
  exercise: Exercise;
  /** Séances où l'exercice a au moins une série qui compte. */
  sessions: number;
  sets: number;
  lastDate: string | null;
  /** Meilleur 1RM estimé. */
  bestE1rm: number | null;
  /** Charge la plus lourde (0 = poids du corps seul). */
  maxWeight: number | null;
  /** Plus grand nombre de répétitions sur une série. */
  maxReps: number | null;
  /** Progrès depuis la première séance : 0,12 = +12 % (1RM estimé, ou répétitions au poids du corps). */
  progress: number | null;
}

export function libraryEntries(exercises: Exercise[], sets: SetEntry[], sessions: Map<ID, Session>): LibraryEntry[] {
  const byExercise = new Map<ID, (SetEntry & { weight: number; reps: number })[]>();
  for (const set of sets) {
    if (!isCountedSet(set) || sessions.get(set.sessionId)?.status !== 'done') continue;
    const list = byExercise.get(set.exerciseId);
    if (list) list.push(set);
    else byExercise.set(set.exerciseId, [set]);
  }

  return exercises.map((exercise) => {
    const lifts = byExercise.get(exercise.id) ?? [];
    if (lifts.length === 0) {
      return { exercise, sessions: 0, sets: 0, lastDate: null, bestE1rm: null, maxWeight: null, maxReps: null, progress: null };
    }
    let bestE1rm: number | null = null;
    let maxWeight = 0;
    let maxReps = 0;
    // Au poids du corps, la charge saisie n'est que le lest : un 1RM estimé dessus n'aurait pas de sens.
    // On suit alors les répétitions sans lest.
    const bodyweight = exercise.equipment === 'poids-du-corps';
    // Une valeur par séance : 1RM estimé, ou répétitions quand tout est au poids du corps.
    const loaded = !bodyweight && lifts.some((l) => l.weight > 0);
    const perSession = new Map<ID, { startedAt: number; value: number | null }>();
    let lastDate = '';
    for (const lift of lifts) {
      const session = sessions.get(lift.sessionId)!;
      const e1rm = bodyweight ? null : epley1RM(lift.weight, lift.reps);
      if (e1rm !== null && (bestE1rm === null || e1rm > bestE1rm)) bestE1rm = e1rm;
      maxWeight = Math.max(maxWeight, lift.weight);
      maxReps = Math.max(maxReps, lift.reps);
      if (session.date > lastDate) lastDate = session.date;
      const value = loaded ? e1rm : bodyweight && lift.weight > 0 ? null : lift.reps;
      const entry = perSession.get(session.id) ?? { startedAt: session.startedAt, value: null };
      if (value !== null && (entry.value === null || value > entry.value)) entry.value = value;
      perSession.set(session.id, entry);
    }
    const values = [...perSession.values()]
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((s) => s.value)
      .filter((v): v is number => v !== null);
    const first = values[0];
    const best = values.length > 0 ? Math.max(...values) : null;
    return {
      exercise,
      sessions: perSession.size,
      sets: lifts.length,
      lastDate,
      bestE1rm,
      maxWeight,
      maxReps,
      progress:
        values.length >= 2 && first > 0 && best !== null ? Math.round(((best - first) / first) * 1000) / 1000 : null,
    };
  });
}

const byName = (a: LibraryEntry, b: LibraryEntry) => a.exercise.name.localeCompare(b.exercise.name, 'fr');

/** Force d'un exercice : 1RM estimé, sinon charge max ; au poids du corps (même lesté), rien de comparable. */
const strength = (e: LibraryEntry) =>
  e.exercise.equipment === 'poids-du-corps'
    ? null
    : (e.bestE1rm ?? (e.maxWeight !== null && e.maxWeight > 0 ? e.maxWeight : null));

/** Trie la liste. Les exercices jamais faits restent à la fin, par ordre alphabétique. */
export function sortLibrary(entries: LibraryEntry[], sort: LibrarySort): LibraryEntry[] {
  const list = [...entries];
  if (sort === 'name') return list.sort(byName);
  const done = list.filter((e) => e.sessions > 0);
  const never = list.filter((e) => e.sessions === 0).sort(byName);
  switch (sort) {
    case 'frequent':
      done.sort((a, b) => b.sessions - a.sessions || b.sets - a.sets || byName(a, b));
      break;
    case 'recent':
      done.sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? '') || byName(a, b));
      break;
    case 'strongest':
      // Les exercices chargés d'abord (du plus lourd au plus léger), puis ceux au poids du corps (aux répétitions).
      done.sort((a, b) => {
        const sa = strength(a);
        const sb = strength(b);
        if (sa !== null && sb !== null) return sb - sa || byName(a, b);
        if (sa !== null) return -1;
        if (sb !== null) return 1;
        return (b.maxReps ?? 0) - (a.maxReps ?? 0) || byName(a, b);
      });
      break;
    case 'progress':
      done.sort((a, b) => {
        if (a.progress !== null && b.progress !== null) return b.progress - a.progress || byName(a, b);
        if (a.progress !== null) return -1;
        if (b.progress !== null) return 1;
        return b.sessions - a.sessions || byName(a, b);
      });
      break;
  }
  return [...done, ...never];
}

/** Exercices de la bibliothèque (sans les masqués), avec leurs chiffres. */
export async function getLibrary(database: AppDB = db): Promise<LibraryEntry[]> {
  const [exercises, sets, sessions] = await Promise.all([
    database.exercises.toArray(),
    database.sets.toArray(),
    database.sessions.where('status').equals('done').toArray(),
  ]);
  return libraryEntries(
    exercises.filter((e) => !e.archived),
    sets,
    new Map(sessions.map((s) => [s.id, s])),
  );
}
