import { describe, expect, it } from 'vitest';
import {
  buildRecap,
  getPendingRecaps,
  markRecapSeen,
  nextRecapKey,
  pendingRecapKeys,
  previousRecapKey,
  recapPeriod,
  type RecapInput,
} from './recap';
import type { Muscle, Session, SessionExercise, SetEntry } from './types';
import { freshDb } from '../test/helpers';

const at = (date: string, hour = 18) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();

function makeInput(rows: { date: string; exerciseId: string; muscle: Muscle; lifts: [number, number][]; minutes?: number }[]): RecapInput {
  const sessions: Session[] = [];
  const sessionExercises: SessionExercise[] = [];
  const sets: SetEntry[] = [];
  rows.forEach((row, index) => {
    const id = `s${index}`;
    const t = at(row.date);
    sessions.push({
      id,
      status: 'done',
      startedAt: t,
      endedAt: t + (row.minutes ?? 60) * 60_000,
      date: row.date,
      programId: null,
      programName: null,
      workoutId: null,
      workoutName: `Séance ${index}`,
      note: '',
      createdAt: t,
      updatedAt: t,
    });
    sessionExercises.push({
      id: `${id}-e`,
      sessionId: id,
      order: 0,
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseId,
      primaryMuscle: row.muscle,
      secondaryMuscles: [],
      equipment: 'barre',
      planned: null,
      supersetGroup: null,
      note: '',
      createdAt: t,
      updatedAt: t,
    });
    row.lifts.forEach(([weight, reps], order) =>
      sets.push({
        id: `${id}-${order}`,
        sessionId: id,
        sessionExerciseId: `${id}-e`,
        exerciseId: row.exerciseId,
        order,
        type: 'normal',
        weight,
        reps,
        rpe: null,
        done: true,
        completedAt: t + order,
        createdAt: t,
        updatedAt: t,
      }),
    );
  });
  return {
    sessions,
    sessionExercises,
    sets,
    bodyweights: [],
    names: new Map([
      ['bench', 'Développé couché'],
      ['squat', 'Squat'],
    ]),
    goals: [],
    today: '2026-12-02',
  };
}

describe('périodes', () => {
  it('mois et années, avec le précédent et le suivant', () => {
    expect(recapPeriod('2026-02')).toMatchObject({ kind: 'month', start: '2026-02-01', end: '2026-02-28' });
    expect(recapPeriod('2026')).toMatchObject({ kind: 'year', start: '2026-01-01', end: '2026-12-31' });
    expect(recapPeriod('2026-13')).toBeNull();
    expect(recapPeriod('n’importe quoi')).toBeNull();
    expect(previousRecapKey(recapPeriod('2026-01')!)).toBe('2025-12');
    expect(nextRecapKey(recapPeriod('2026-12')!)).toBe('2027-01');
    expect(previousRecapKey(recapPeriod('2026')!)).toBe('2025');
  });
});

describe('bilan du mois', () => {
  const input = makeInput([
    { date: '2026-10-05', exerciseId: 'bench', muscle: 'pectoraux', lifts: [[80, 5], [80, 5]] },
    { date: '2026-11-03', exerciseId: 'bench', muscle: 'pectoraux', lifts: [[85, 5], [85, 4]], minutes: 50 },
    { date: '2026-11-03', exerciseId: 'squat', muscle: 'quadriceps', lifts: [[100, 5]] },
    { date: '2026-11-20', exerciseId: 'bench', muscle: 'pectoraux', lifts: [[90, 3]], minutes: 75 },
  ]);
  const recap = buildRecap(recapPeriod('2026-11')!, input);

  it('totaux du mois et comparaison avec le mois d’avant', () => {
    expect(recap.totals).toEqual({ sessions: 3, activeDays: 2, durationSec: (50 + 60 + 75) * 60, volume: 425 + 340 + 500 + 270, sets: 4, reps: 17 });
    expect(recap.previous).toMatchObject({ sessions: 1, volume: 800 });
    expect(recap.days).toEqual(['2026-11-03', '2026-11-20']);
    expect(recap.inProgress).toBe(false);
  });

  it('records battus, progrès et exercices les plus travaillés', () => {
    // 85 × 5 bat 80 × 5, puis 90 × 3 bat la charge la plus lourde. Le squat (première fois) ne bat rien.
    expect(recap.recordCount).toBe(2);
    expect(recap.records).toEqual([
      expect.objectContaining({ exerciseId: 'bench', exerciseName: 'Développé couché', weight: 90, reps: 3, date: '2026-11-20' }),
    ]);
    expect(recap.progress).toEqual([
      expect.objectContaining({ exerciseId: 'bench', before: 93.3, after: 99.2, unit: 'kg' }),
    ]);
    expect(recap.exercises.map((e) => [e.name, e.sets, e.sessions])).toEqual([
      ['Développé couché', 3, 2],
      ['Squat', 1, 1],
    ]);
    expect(recap.muscles).toEqual([
      { muscle: 'pectoraux', sets: 3 },
      { muscle: 'quadriceps', sets: 1 },
    ]);
    expect(recap.longest).toMatchObject({ durationSec: 75 * 60, date: '2026-11-20' });
    expect(recap.heaviest).toMatchObject({ volume: 765, date: '2026-11-03' });
  });

  it('premier mois : rien à comparer', () => {
    const first = buildRecap(recapPeriod('2026-10')!, input);
    expect(first.previous).toBeNull();
    expect(first.recordCount).toBe(0);
  });

  it('bilan de l’année : séances et volume de chaque mois', () => {
    const year = buildRecap(recapPeriod('2026')!, input);
    expect(year.totals.sessions).toBe(4);
    expect(year.months).toHaveLength(12);
    expect(year.months[9]).toEqual({ key: '2026-10', sessions: 1, volume: 800 });
    expect(year.months[10]).toEqual({ key: '2026-11', sessions: 3, volume: 1535 });
  });
});

describe('bilans à découvrir sur l’accueil', () => {
  it('le mois dernier dès le 1er du mois, l’année passée en janvier', () => {
    const seen = { month: null, year: null };
    expect(pendingRecapKeys({ sessionDates: ['2026-10-12'], today: '2026-11-01', seen })).toEqual(['2026-10']);
    // Aucune séance le mois dernier : pas de bilan.
    expect(pendingRecapKeys({ sessionDates: ['2026-09-12'], today: '2026-11-01', seen })).toEqual([]);
    expect(pendingRecapKeys({ sessionDates: ['2026-12-12'], today: '2027-01-03', seen })).toEqual(['2026', '2026-12']);
    expect(pendingRecapKeys({ sessionDates: ['2026-12-12'], today: '2027-02-03', seen })).toEqual([]);
    expect(
      pendingRecapKeys({ sessionDates: ['2026-10-12'], today: '2026-11-01', seen: { month: '2026-10', year: null } }),
    ).toEqual([]);
  });

  it('un bilan vu ne revient plus', async () => {
    const database = await freshDb();
    await database.sessions.add({
      id: 's1',
      status: 'done',
      startedAt: at('2026-10-12'),
      endedAt: at('2026-10-12', 19),
      date: '2026-10-12',
      programId: null,
      programName: null,
      workoutId: null,
      workoutName: 'Séance',
      note: '',
      createdAt: 0,
      updatedAt: 0,
    });
    expect(await getPendingRecaps(at('2026-11-02'), database)).toEqual(['2026-10']);
    await markRecapSeen('2026-10', database);
    expect(await getPendingRecaps(at('2026-11-02'), database)).toEqual([]);
    // Revoir un bilan plus ancien ne fait pas revenir le dernier.
    await markRecapSeen('2026-09', database);
    expect(await getPendingRecaps(at('2026-11-02'), database)).toEqual([]);
    database.close();
  });
});
