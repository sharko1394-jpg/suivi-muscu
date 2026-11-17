import { describe, expect, it } from 'vitest';
import type { AppDB } from './db';
import { seedBuiltinExercises } from './exercises';
import { addPersonalGoal, deletePersonalGoal, getGoalStatuses, updatePersonalGoal } from './goals';
import { normalizeGoals } from './goalsModel';
import { getSettings } from './settings';
import { saveBodyweight } from './stats';
import type { Session, SetEntry } from './types';
import { freshDb } from '../test/helpers';

const BENCH = 'ex-developpe-couche-barre';
const PULL_UP = 'ex-tractions-pronation';
const at = (date: string, hour = 18) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();

let counter = 0;

/** Ajoute une séance terminée avec ses séries (charge, répétitions). */
async function addSession(database: AppDB, date: string, exerciseId: string, lifts: [number, number][]): Promise<void> {
  const id = `s-${++counter}`;
  const t = at(date);
  const session: Session = {
    id,
    status: 'done',
    startedAt: t,
    endedAt: t + 3_600_000,
    date,
    programId: null,
    programName: null,
    workoutId: null,
    workoutName: 'Séance',
    note: '',
    createdAt: t,
    updatedAt: t,
  };
  await database.sessions.add(session);
  await database.sets.bulkAdd(
    lifts.map(([weight, reps], index): SetEntry => ({
      id: `${id}-set-${index}`,
      sessionId: id,
      sessionExerciseId: `${id}-ex`,
      exerciseId,
      order: index,
      type: 'normal',
      weight,
      reps,
      rpe: null,
      done: true,
      completedAt: t + index,
      createdAt: t,
      updatedAt: t,
    })),
  );
}

async function setup(): Promise<AppDB> {
  const database = await freshDb();
  await seedBuiltinExercises(database);
  return database;
}

describe('objectif de charge', () => {
  it('part de la meilleure performance, avance avec les séances, puis est atteint', async () => {
    const database = await setup();
    await addSession(database, '2026-10-01', BENCH, [[80, 5], [85, 3]]);
    await addPersonalGoal({ kind: 'lift', exerciseId: BENCH, target: 100, reps: 5, deadline: '2027-06-30' }, at('2026-10-02'), database);

    let [status] = await getGoalStatuses(at('2026-10-02'), database);
    expect(status.title).toBe('Développé couché (barre)');
    // Départ : 80 kg pour au moins 5 répétitions (85 × 3 ne compte pas).
    expect(status.startValue).toBe(80);
    expect(status.ratio).toBe(0);
    expect(status.achievedOn).toBeNull();

    await addSession(database, '2026-11-01', BENCH, [[90, 6]]);
    [status] = await getGoalStatuses(at('2026-11-02'), database);
    expect(status.current).toBe(90);
    expect(status.ratio).toBeCloseTo(0.5);

    await addSession(database, '2026-12-01', BENCH, [[100, 5]]);
    [status] = await getGoalStatuses(at('2026-12-02'), database);
    expect(status.achievedOn).toBe('2026-12-01');
    expect(status.ratio).toBe(1);
    database.close();
  });

  it('un objectif déjà atteint est refusé', async () => {
    const database = await setup();
    await addSession(database, '2026-10-01', BENCH, [[100, 6]]);
    await expect(
      addPersonalGoal({ kind: 'lift', exerciseId: BENCH, target: 100, reps: 5 }, at('2026-10-02'), database),
    ).rejects.toThrow('Déjà fait');
    database.close();
  });

  it('au poids du corps (0 kg), on vise un nombre de répétitions', async () => {
    const database = await setup();
    await addSession(database, '2026-10-01', PULL_UP, [[0, 6], [0, 5]]);
    await addPersonalGoal({ kind: 'lift', exerciseId: PULL_UP, target: 0, reps: 12 }, at('2026-10-02'), database);
    await addSession(database, '2026-10-10', PULL_UP, [[0, 9]]);
    const [status] = await getGoalStatuses(at('2026-10-11'), database);
    expect(status.unit).toBe('reps');
    expect(status.startValue).toBe(6);
    expect(status.current).toBe(9);
    expect(status.ratio).toBeCloseTo(0.5);
    database.close();
  });
});

describe('objectif de poids de corps', () => {
  it('sans pesée, le poids actuel est demandé ; l’avancement suit les pesées', async () => {
    const database = await setup();
    await expect(addPersonalGoal({ kind: 'bodyweight', target: 75 }, at('2026-10-01'), database)).rejects.toThrow(
      'poids actuel',
    );
    await addPersonalGoal({ kind: 'bodyweight', target: 75, currentWeight: 80 }, at('2026-10-01'), database);
    await saveBodyweight('2026-10-15', 77.5, at('2026-10-15'), database);
    let [status] = await getGoalStatuses(at('2026-10-15'), database);
    expect(status.ratio).toBeCloseTo(0.5);
    await saveBodyweight('2026-11-01', 74.8, at('2026-11-01'), database);
    [status] = await getGoalStatuses(at('2026-11-01'), database);
    expect(status.achievedOn).toBe('2026-11-01');
    database.close();
  });
});

describe('objectif de séances', () => {
  it('compte les séances faites à partir du jour où il est fixé', async () => {
    const database = await setup();
    await addSession(database, '2026-10-01', BENCH, [[60, 10]]);
    await addPersonalGoal({ kind: 'sessions', target: 2, deadline: '2026-12-31' }, at('2026-10-01', 20), database);
    await addSession(database, '2026-10-03', BENCH, [[60, 10]]);
    let [status] = await getGoalStatuses(at('2026-10-04'), database);
    expect(status.current).toBe(1);
    expect(status.daysLeft).toBe(88);
    await addSession(database, '2026-10-05', BENCH, [[60, 10]]);
    [status] = await getGoalStatuses(at('2026-10-06'), database);
    expect(status.achievedOn).toBe('2026-10-05');
    database.close();
  });
});

describe('modifier et supprimer', () => {
  it('date limite passée refusée, cible modifiable, suppression', async () => {
    const database = await setup();
    await expect(
      addPersonalGoal({ kind: 'sessions', target: 10, deadline: '2026-09-01' }, at('2026-10-01'), database),
    ).rejects.toThrow('date limite');
    const goal = await addPersonalGoal({ kind: 'sessions', target: 10 }, at('2026-10-01'), database);
    await updatePersonalGoal(goal.id, { target: 20, deadline: '2026-12-31' }, at('2026-10-02'), database);
    expect((await getSettings(database)).personalGoals[0]).toMatchObject({ target: 20, deadline: '2026-12-31' });
    await deletePersonalGoal(goal.id, database);
    expect((await getSettings(database)).personalGoals).toEqual([]);
    database.close();
  });

  it('les objectifs abîmés sont écartés à la lecture', () => {
    const goals = normalizeGoals([
      { id: 'a', kind: 'lift', exerciseId: BENCH, target: 100, reps: 5, start: 80, deadline: '2026-02-30', createdAt: 1 },
      { id: 'b', kind: 'lift', target: 100, start: 0 },
      { id: 'c', kind: 'magie', target: 1, start: 0 },
      { id: 'a', kind: 'sessions', target: 3, start: 0 },
      'n’importe quoi',
    ]);
    expect(goals).toEqual([
      { id: 'a', kind: 'lift', exerciseId: BENCH, target: 100, reps: 5, start: 80, deadline: null, createdAt: 1 },
    ]);
  });
});
