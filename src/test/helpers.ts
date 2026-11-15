import { createDb, type AppDB } from '../data/db';
import { seedBuiltinExercises } from '../data/exercises';
import type { SchemaVersion } from '../data/schema';
import type { Dump } from '../data/types';

let counter = 0;

/** Nom de base unique : chaque test part d'un téléphone « neuf ». */
export const freshName = () => `test-${++counter}-${Math.random().toString(36).slice(2)}`;

export async function freshDb(versions?: SchemaVersion[]): Promise<AppDB> {
  const database = createDb(freshName(), versions);
  await database.open();
  return database;
}

/** Contenu complet d'une base, tiroirs et lignes triés pour pouvoir comparer. */
export async function dumpOf(database: AppDB): Promise<Dump> {
  const dump: Dump = {};
  for (const table of [...database.tables].sort((a, b) => a.name.localeCompare(b.name))) {
    dump[table.name] = await table.orderBy(':id').toArray();
  }
  return dump;
}

const T0 = new Date(2026, 9, 1, 18, 30).getTime(); // 1er octobre 2026, 18:30 (heure locale)

/** Remplit une base avec un peu de tout : exercices, programme, séances, pesées, réglages. */
export async function fillSampleData(database: AppDB): Promise<void> {
  await seedBuiltinExercises(database);

  await database.exercises.add({
    id: 'custom-1',
    name: 'Tirage « maison »',
    primaryMuscle: 'dos',
    secondaryMuscles: ['biceps'],
    equipment: 'poulie',
    isCustom: true,
    archived: false,
    weightStep: 1.25,
    createdAt: T0,
    updatedAt: T0,
  });

  await database.programs.add({
    id: 'prog-1',
    name: 'Upper / Lower',
    status: 'active',
    scheduleMode: 'rotation',
    fixedDays: {},
    rotation: ['wk-a', 'wk-b'],
    nextRotationIndex: 1,
    createdAt: T0,
    updatedAt: T0,
  });

  await database.programWorkouts.bulkAdd([
    {
      id: 'wk-a',
      programId: 'prog-1',
      name: 'Upper A',
      order: 0,
      items: [
        {
          id: 'item-1',
          exerciseId: 'ex-developpe-couche-barre',
          sets: 3,
          repMin: 8,
          repMax: 12,
          targetWeight: 80,
          restSec: 150,
          note: 'banc n° 2',
          supersetGroup: null,
        },
        {
          id: 'item-2',
          exerciseId: 'custom-1',
          sets: 4,
          repMin: 10,
          repMax: 15,
          targetWeight: null,
          restSec: 90,
          note: '',
          supersetGroup: null,
        },
      ],
      createdAt: T0,
      updatedAt: T0,
    },
    { id: 'wk-b', programId: 'prog-1', name: 'Lower A', order: 1, items: [], createdAt: T0, updatedAt: T0 },
  ]);

  await database.sessions.bulkAdd([
    {
      id: 'ses-1',
      status: 'done',
      startedAt: T0,
      endedAt: T0 + 65 * 60_000,
      date: '2026-10-01',
      programId: 'prog-1',
      programName: 'Upper / Lower',
      workoutId: 'wk-a',
      workoutName: 'Upper A',
      note: 'Bonne séance ; en forme',
      createdAt: T0,
      updatedAt: T0,
    },
    {
      id: 'ses-2',
      status: 'inProgress',
      startedAt: T0 + 2 * 86_400_000,
      endedAt: null,
      date: '2026-10-03',
      programId: null,
      programName: null,
      workoutId: null,
      workoutName: 'Séance libre',
      note: '',
      createdAt: T0,
      updatedAt: T0,
    },
  ]);

  await database.sessionExercises.bulkAdd([
    {
      id: 'se-1',
      sessionId: 'ses-1',
      order: 0,
      exerciseId: 'ex-developpe-couche-barre',
      exerciseName: 'Développé couché (barre)',
      primaryMuscle: 'pectoraux',
      secondaryMuscles: ['triceps', 'epaules'],
      equipment: 'barre',
      planned: { sets: 3, repMin: 8, repMax: 12, targetWeight: 80, restSec: 150, note: 'banc n° 2' },
      supersetGroup: null,
      note: 'Prise "large"',
      createdAt: T0,
      updatedAt: T0,
    },
    {
      id: 'se-2',
      sessionId: 'ses-2',
      order: 0,
      exerciseId: 'custom-1',
      exerciseName: 'Tirage « maison »',
      primaryMuscle: 'dos',
      secondaryMuscles: ['biceps'],
      equipment: 'poulie',
      planned: null,
      supersetGroup: null,
      note: '',
      createdAt: T0,
      updatedAt: T0,
    },
  ]);

  const set = (id: string, order: number, extra: object) => ({
    id,
    sessionId: 'ses-1',
    sessionExerciseId: 'se-1',
    exerciseId: 'ex-developpe-couche-barre',
    order,
    type: 'normal' as const,
    weight: 80,
    reps: 8,
    rpe: null,
    done: true,
    completedAt: T0 + order * 180_000,
    createdAt: T0,
    updatedAt: T0,
    ...extra,
  });

  await database.sets.bulkAdd([
    set('set-1', 0, { type: 'warmup', weight: 40, reps: 10 }),
    set('set-2', 1, { weight: 82.5, reps: 8, rpe: 8.5 }),
    set('set-3', 2, { reps: 7, type: 'failure' }),
    set('set-4', 3, { done: false, completedAt: null }),
    set('set-5', 0, {
      sessionId: 'ses-2',
      sessionExerciseId: 'se-2',
      exerciseId: 'custom-1',
      weight: 55,
      reps: 12,
    }),
  ]);

  await database.bodyweights.bulkAdd([
    { id: 'bw-1', date: '2026-10-01', weightKg: 78.4, createdAt: T0, updatedAt: T0 },
    { id: 'bw-2', date: '2026-10-08', weightKg: 78.1, createdAt: T0, updatedAt: T0 },
  ]);

  await database.settings.bulkPut([
    { key: 'weightStep', value: 1.25, updatedAt: T0 },
    { key: 'firstLaunchAt', value: T0, updatedAt: T0 },
  ]);
}
