import { describe, expect, it } from 'vitest';
import type { AppDB } from './db';
import { seedBuiltinExercises } from './exercises';
import { deleteSession, setSessionDate } from './history';
import { addPlannedExercise, addWorkout, createProgram } from './programs';
import { completeSet, finishSession, getSessionDetail, startSession, updateSet } from './sessions';
import {
  deleteBodyweight,
  getExerciseStats,
  getGeneralStats,
  listBodyweights,
  listTrackedExercises,
  muscleSetsByWeek,
  periodStart,
  repMaxTable,
  saveBodyweight,
  weekStart,
  weekStreaks,
  weeklyAttendance,
} from './stats';
import { AppError, DAY_MS, localDate } from './util';
import { freshDb } from '../test/helpers';

const BENCH = 'ex-developpe-couche-barre';
const PULLUP = 'ex-tractions-pronation';

describe('semaines et périodes', () => {
  it('la semaine commence le lundi', () => {
    expect(weekStart('2026-11-16')).toBe('2026-11-16'); // lundi
    expect(weekStart('2026-11-18')).toBe('2026-11-16'); // mercredi
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // dimanche
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // dimanche d'avant
    expect(weekStart('2027-01-01')).toBe('2026-12-28'); // à cheval sur deux années
  });

  it('début de période', () => {
    const now = new Date(2026, 10, 15, 12).getTime();
    expect(periodStart('1m', now)).toBe('2026-10-16');
    expect(periodStart('1y', now)).toBe('2025-11-15');
    expect(periodStart('all', now)).toBeNull();
  });
});

describe('tableau des records', () => {
  const lifts = [
    { weight: 100, reps: 1, date: '2026-10-01' },
    { weight: 90, reps: 4, date: '2026-10-08' },
    { weight: 80, reps: 9, date: '2026-10-15' },
    { weight: 80, reps: 9, date: '2026-10-22' },
    { weight: 60, reps: 12, date: '2026-10-29' },
  ];

  it('meilleure charge pour au moins 1, 3, 5, 8 et 10 répétitions', () => {
    expect(repMaxTable(lifts)).toEqual([
      { reps: 1, weight: 100, date: '2026-10-01' },
      { reps: 3, weight: 90, date: '2026-10-08' },
      { reps: 5, weight: 80, date: '2026-10-15' }, // 80 × 9 compte pour 5 et pour 8
      { reps: 8, weight: 80, date: '2026-10-15' }, // première fois atteinte, pas la répétition
      { reps: 10, weight: 60, date: '2026-10-29' },
    ]);
  });

  it('une ligne vide quand ce n’est jamais arrivé', () => {
    expect(repMaxTable([{ weight: 100, reps: 2, date: '2026-10-01' }])).toEqual([
      { reps: 1, weight: 100, date: '2026-10-01' },
      { reps: 3, weight: null, date: null },
      { reps: 5, weight: null, date: null },
      { reps: 8, weight: null, date: null },
      { reps: 10, weight: null, date: null },
    ]);
  });
});

describe('assiduité', () => {
  const today = '2026-11-18'; // mercredi ; semaine du lundi 16

  it('séances par semaine, semaines vides comprises', () => {
    const weeks = weeklyAttendance(['2026-11-16', '2026-11-17', '2026-11-09', '2026-10-28'], today, 4);
    expect(weeks).toEqual([
      { week: '2026-10-26', count: 1 },
      { week: '2026-11-02', count: 0 },
      { week: '2026-11-09', count: 1 },
      { week: '2026-11-16', count: 2 },
    ]);
  });

  it('série de semaines consécutives', () => {
    // Semaines des 26 oct., 2 nov., 9 nov. et 16 nov. : quatre de suite.
    expect(weekStreaks(['2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17'], today)).toEqual({
      current: 4,
      best: 4,
    });
  });

  it('la semaine en cours, pas encore finie, ne casse pas la série', () => {
    expect(weekStreaks(['2026-11-03', '2026-11-10'], today)).toEqual({ current: 2, best: 2 });
  });

  it('une semaine sautée remet la série à zéro, le record reste', () => {
    const dates = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-11-17'];
    expect(weekStreaks(dates, today)).toEqual({ current: 1, best: 3 });
    expect(weekStreaks(['2026-09-01', '2026-09-08'], today)).toEqual({ current: 0, best: 2 });
    expect(weekStreaks([], today)).toEqual({ current: 0, best: 0 });
  });

  it('plusieurs séances la même semaine ne comptent que pour une semaine', () => {
    expect(weekStreaks(['2026-11-16', '2026-11-17', '2026-11-18'], today)).toEqual({ current: 1, best: 1 });
  });
});

describe('séries par groupe musculaire', () => {
  it('compte par muscle principal et par semaine, du plus au moins sollicité', () => {
    const weeks = muscleSetsByWeek([
      { date: '2026-11-16', muscle: 'pectoraux' },
      { date: '2026-11-17', muscle: 'pectoraux' },
      { date: '2026-11-18', muscle: 'dos' },
      { date: '2026-11-10', muscle: 'dos' },
    ]);
    expect(weeks.get('2026-11-16')).toEqual({
      week: '2026-11-16',
      muscles: [
        { muscle: 'pectoraux', sets: 2 },
        { muscle: 'dos', sets: 1 },
      ],
      total: 3,
    });
    expect(weeks.get('2026-11-09')?.total).toBe(1);
  });
});

async function setup() {
  const db = await freshDb();
  await seedBuiltinExercises(db);
  const program = await createProgram('Programme', db);
  const a = await addWorkout(program.id, 'Upper A', db);
  await addPlannedExercise(a.id, BENCH, db);
  await addPlannedExercise(a.id, PULLUP, db);
  return { db, a };
}

/** Séance terminée il y a `daysAgo` jours : séries de développé couché, puis une de tractions. */
async function doSession(
  db: AppDB,
  workoutId: string,
  bench: [number, number, 'normal' | 'warmup'][],
  pullups: number,
  daysAgo: number,
) {
  const session = await startSession(workoutId, db);
  const { exercises } = (await getSessionDetail(session.id, db))!;
  for (const [index, [weight, reps, type]] of bench.entries()) {
    await updateSet(exercises[0].sets[index].id, { weight, reps, type }, db);
    await completeSet(exercises[0].sets[index].id, session.startedAt + index * 60_000, db);
  }
  await updateSet(exercises[1].sets[0].id, { weight: 0, reps: pullups }, db);
  await completeSet(exercises[1].sets[0].id, session.startedAt + 600_000, db);
  await finishSession(session.id, session.startedAt + 1_200_000, db);
  if (daysAgo > 0) await setSessionDate(session.id, localDate(session.startedAt - daysAgo * DAY_MS), Date.now(), db);
  return session.id;
}

describe('progression d’un exercice', () => {
  it('un point par séance : charge max, 1RM estimé, volume, meilleure série', async () => {
    const { db, a } = await setup();
    await doSession(db, a.id, [[40, 10, 'warmup'], [80, 8, 'normal'], [85, 5, 'normal']], 8, 14);
    await doSession(db, a.id, [[82.5, 8, 'normal'], [82.5, 7, 'normal']], 10, 7);
    await startSession(a.id, db); // la séance en cours ne compte pas

    const { points, repMax } = await getExerciseStats(BENCH, db);
    expect(points.map(({ sessionId: _id, ...p }) => p)).toEqual([
      {
        date: localDate(Date.now() - 14 * DAY_MS),
        maxWeight: 85,
        e1rm: 101.3, // 80 × 8
        volume: 80 * 8 + 85 * 5, // l'échauffement ne compte pas
        bestSet: { weight: 80, reps: 8 },
      },
      {
        date: localDate(Date.now() - 7 * DAY_MS),
        maxWeight: 82.5,
        e1rm: 104.5,
        volume: 82.5 * 15,
        bestSet: { weight: 82.5, reps: 8 },
      },
    ]);
    expect(repMax.map((r) => r.weight)).toEqual([85, 85, 85, 82.5, null]);
    db.close();
  });

  it('au poids du corps : pas de 1RM, la meilleure série est celle avec le plus de répétitions', async () => {
    const { db, a } = await setup();
    await doSession(db, a.id, [[80, 8, 'normal']], 9, 7);
    const { points, repMax } = await getExerciseStats(PULLUP, db);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ maxWeight: 0, e1rm: null, volume: 0, bestSet: { weight: 0, reps: 9 } });
    expect(repMax.map((r) => r.weight)).toEqual([0, 0, 0, 0, null]);
    db.close();
  });

  it('liste des exercices suivis, le plus récent d’abord ; une suppression se répercute', async () => {
    const { db, a } = await setup();
    const old = await doSession(db, a.id, [[80, 8, 'normal']], 8, 14);
    await doSession(db, a.id, [[80, 8, 'normal']], 9, 3);
    const tracked = await listTrackedExercises(db);
    expect(tracked.map((t) => [t.name, t.sessionCount])).toEqual([
      ['Développé couché (barre)', 2],
      ['Tractions (pronation)', 2],
    ]);
    expect(tracked[0].lastDate).toBe(localDate(Date.now() - 3 * DAY_MS));

    await deleteSession(old, db);
    expect((await listTrackedExercises(db)).map((t) => t.sessionCount)).toEqual([1, 1]);
    expect((await getExerciseStats(BENCH, db)).points).toHaveLength(1);
    db.close();
  });
});

describe('vue d’ensemble', () => {
  it('assiduité et séries par muscle tirées des vraies séances', async () => {
    const { db, a } = await setup();
    await doSession(db, a.id, [[80, 8, 'normal'], [80, 8, 'normal']], 8, 0);
    await doSession(db, a.id, [[40, 10, 'warmup'], [80, 8, 'normal']], 8, 7);
    const stats = await getGeneralStats(Date.now(), db);

    expect(stats.totalSessions).toBe(2);
    expect(stats.streaks).toEqual({ current: 2, best: 2 });
    expect(stats.attendance).toHaveLength(12);
    expect(stats.attendance.slice(-2).map((w) => w.count)).toEqual([1, 1]);
    expect(stats.muscleWeeks.map((w) => w.muscles)).toEqual([
      [
        { muscle: 'pectoraux', sets: 2 },
        { muscle: 'dos', sets: 1 },
      ],
      [
        { muscle: 'dos', sets: 1 },
        { muscle: 'pectoraux', sets: 1 }, // l'échauffement ne compte pas
      ],
    ]);
    db.close();
  });
});

describe('poids de corps', () => {
  it('une pesée par jour, la nouvelle remplace l’ancienne ; liste par date', async () => {
    const db = await freshDb();
    const now = new Date(2026, 10, 15, 9).getTime();
    await saveBodyweight('2026-11-15', 78.44, now, db);
    await saveBodyweight('2026-11-01', 79, now, db);
    const replaced = await saveBodyweight('2026-11-15', 78.2, now, db);

    const list = await listBodyweights(db);
    expect(list.map((b) => [b.date, b.weightKg])).toEqual([
      ['2026-11-01', 79],
      ['2026-11-15', 78.2],
    ]);
    await deleteBodyweight(replaced.id, db);
    expect(await listBodyweights(db)).toHaveLength(1);
    db.close();
  });

  it('refuse les valeurs et les dates impossibles', async () => {
    const db = await freshDb();
    const now = new Date(2026, 10, 15, 9).getTime();
    await expect(saveBodyweight('2026-11-15', 5, now, db)).rejects.toThrow(AppError);
    await expect(saveBodyweight('2026-11-15', 999, now, db)).rejects.toThrow(AppError);
    await expect(saveBodyweight('2026-11-15', Number.NaN, now, db)).rejects.toThrow(AppError);
    await expect(saveBodyweight('2026-11-16', 78, now, db)).rejects.toThrow(AppError);
    await expect(saveBodyweight('2026-02-30', 78, now, db)).rejects.toThrow(AppError);
    await expect(saveBodyweight('hier', 78, now, db)).rejects.toThrow(AppError);
    expect(await listBodyweights(db)).toHaveLength(0);
    db.close();
  });
});
