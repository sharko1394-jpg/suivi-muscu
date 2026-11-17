import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from './builtinExercises';
import { MOVEMENTS, exerciseGuide, guessMovement } from './exerciseGuide';
import { libraryEntries, sortLibrary } from './library';
import type { Exercise, Session, SetEntry } from './types';

const exercise = (id: string, name: string): Exercise => ({
  id,
  name,
  primaryMuscle: 'pectoraux',
  secondaryMuscles: [],
  equipment: 'barre',
  isCustom: false,
  archived: false,
  weightStep: null,
  createdAt: 0,
  updatedAt: 0,
});

const sessions = new Map<string, Session>();
const sets: SetEntry[] = [];
function lift(exerciseId: string, date: string, weight: number, reps: number) {
  const id = `${date}-${exerciseId}-${sets.length}`;
  const t = new Date(`${date}T18:00:00`).getTime() + sets.length;
  sessions.set(id, {
    id,
    status: 'done',
    startedAt: t,
    endedAt: t,
    date,
    programId: null,
    programName: null,
    workoutId: null,
    workoutName: 'Séance',
    note: '',
    createdAt: t,
    updatedAt: t,
  });
  sets.push({
    id,
    sessionId: id,
    sessionExerciseId: id,
    exerciseId,
    order: 0,
    type: 'normal',
    weight,
    reps,
    rpe: null,
    done: true,
    completedAt: t,
    createdAt: t,
    updatedAt: t,
  });
}

// Développé : 3 séances, 80 → 90 kg. Squat : 2 séances, plus lourd, peu de progrès. Tractions : poids du corps.
lift('bench', '2026-10-01', 80, 5);
lift('bench', '2026-10-08', 85, 5);
lift('bench', '2026-10-15', 90, 5);
lift('squat', '2026-10-02', 120, 5);
lift('squat', '2026-10-20', 122.5, 5);
lift('pull', '2026-10-03', 0, 8);
lift('pull', '2026-10-21', 0, 12);

const entries = libraryEntries(
  [exercise('bench', 'Développé'), exercise('squat', 'Squat'), exercise('pull', 'Tractions'), exercise('curl', 'Curl')],
  sets,
  sessions,
);
const order = (sort: Parameters<typeof sortLibrary>[1]) => sortLibrary(entries, sort).map((e) => e.exercise.id);

describe('bibliothèque', () => {
  it('chiffres de chaque exercice', () => {
    const bench = entries.find((e) => e.exercise.id === 'bench')!;
    expect(bench).toMatchObject({ sessions: 3, sets: 3, lastDate: '2026-10-15', maxWeight: 90, bestE1rm: 105 });
    expect(bench.progress).toBeCloseTo(0.125, 3);
    const pull = entries.find((e) => e.exercise.id === 'pull')!;
    expect(pull).toMatchObject({ maxWeight: 0, bestE1rm: null, maxReps: 12, progress: 0.5 });
    expect(entries.find((e) => e.exercise.id === 'curl')).toMatchObject({ sessions: 0, lastDate: null });
  });

  it('tris : les plus faits, les plus forts, le plus de progrès, récents, A → Z', () => {
    // À égalité de séances et de séries : ordre alphabétique.
    expect(order('frequent')).toEqual(['bench', 'squat', 'pull', 'curl']);
    // Les exercices chargés d'abord, puis ceux au poids du corps ; jamais faits à la fin.
    expect(order('strongest')).toEqual(['squat', 'bench', 'pull', 'curl']);
    expect(order('progress')).toEqual(['pull', 'bench', 'squat', 'curl']);
    expect(order('recent')).toEqual(['pull', 'squat', 'bench', 'curl']);
    expect(order('name')).toEqual(['curl', 'bench', 'squat', 'pull']);
  });
});

describe('fiches des exercices', () => {
  it('chaque exercice fourni a sa fiche complète et son dessin', () => {
    for (const builtin of BUILTIN_EXERCISES) {
      const guide = exerciseGuide(builtin);
      expect(guide.movement, builtin.id).not.toBeNull();
      expect(guide.model, builtin.id).not.toBeNull();
      expect(guide.guessed).toBe(false);
      expect(guide.steps.length, builtin.id).toBeGreaterThanOrEqual(3);
      expect(guide.tips.length, builtin.id).toBeGreaterThanOrEqual(2);
      expect(guide.avoid.length, builtin.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('un exercice personnel est rattaché d’après son nom, seulement quand c’est clair', () => {
    expect(guessMovement('Squat sumo')).toBe('squat');
    expect(guessMovement('Leg curl debout')).toBe('lying-leg-curl');
    expect(guessMovement('Curl araignée')).toBe('curl');
    expect(guessMovement('Développé couché prise inversée')).toBe('bench-press');
    expect(guessMovement('Élévation latérale penché')).toBe('lateral-raise');
    expect(guessMovement('Gainage')).toBeNull();
    const custom = exerciseGuide({ id: 'perso-1', name: 'Rowing landmine', equipment: 'barre' });
    expect(custom).toMatchObject({ movement: 'bent-over-row', guessed: true });
    expect(exerciseGuide({ id: 'perso-2', name: 'Planche', equipment: 'poids-du-corps' })).toMatchObject({
      movement: null,
      steps: [],
    });
  });

  it('chaque mouvement a un nom et des explications', () => {
    for (const [id, guide] of Object.entries(MOVEMENTS)) {
      expect(guide.name, id).not.toBe('');
      expect(guide.steps.length, id).toBeGreaterThanOrEqual(3);
    }
  });
});
