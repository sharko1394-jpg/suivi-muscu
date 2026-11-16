import { describe, expect, it } from 'vitest';
import type { AppDB } from './db';
import { seedBuiltinExercises } from './exercises';
import {
  floorToStep,
  getCoachReport,
  loadAdvice,
  prForecast,
  volumeReport,
  type WorkSession,
} from './coach';
import { setSessionDate } from './history';
import { addPlannedExercise, addWorkout, createProgram, updatePlannedExercise } from './programs';
import { completeSet, finishSession, getSessionDetail, startSession, updateSet } from './sessions';
import { setSetting } from './settings';
import type { RepMax } from './stats';
import type { SetType } from './types';
import { DAY_MS, localDate } from './util';
import { freshDb } from '../test/helpers';

const session = (date: string, reps: number[], weight = 80, rpe: number | null = null): WorkSession => ({
  date,
  sets: reps.map((r) => ({ weight, reps: r, rpe })),
});
const advise = (sessions: WorkSession[], repMin = 8, repMax = 12, step = 2.5) =>
  loadAdvice({ sessions, repMin, repMax, step });

describe('conseil de charge (double progression)', () => {
  it('toutes les séries au haut de la fourchette : on monte d’un pas', () => {
    expect(advise([session('2026-11-10', [12, 12, 12])])).toMatchObject({
      status: 'up',
      weight: 80,
      reps: [12, 12, 12],
      suggested: 82.5,
      bigJump: false,
    });
  });

  it('bien au-delà de la fourchette : on monte de deux pas', () => {
    expect(advise([session('2026-11-10', [15, 15, 16])])).toMatchObject({ status: 'up', suggested: 85, bigJump: true });
  });

  it('la moitié des séries au plafond : bientôt', () => {
    expect(advise([session('2026-11-10', [12, 12, 10])])).toMatchObject({ status: 'almost', suggested: null });
  });

  it('bientôt, mais facile (RPE 7 ou moins) : on monte déjà', () => {
    expect(advise([session('2026-11-10', [12, 12, 10], 80, 7)])).toMatchObject({ status: 'up', suggested: 82.5 });
  });

  it('dans la fourchette : on garde la charge', () => {
    expect(advise([session('2026-11-10', [10, 9, 9])])).toMatchObject({ status: 'keep', suggested: null });
  });

  it('une seule séance difficile ne suffit pas pour baisser', () => {
    expect(advise([session('2026-11-03', [10, 9, 8]), session('2026-11-10', [7, 7, 6])])).toMatchObject({
      status: 'keep',
    });
  });

  it('deux séances de suite sous la fourchette à la même charge : on baisse de 10 %', () => {
    expect(advise([session('2026-11-03', [7, 6, 6]), session('2026-11-10', [7, 7, 6])])).toMatchObject({
      status: 'down',
      suggested: 70, // 80 × 0,9 = 72, arrondi au pas de 2,5 kg en dessous
    });
  });

  it('après une montée ratée : retour à la dernière charge réussie', () => {
    const sessions = [session('2026-10-27', [12, 11, 10], 14), session('2026-11-03', [6, 5, 5], 16), session('2026-11-10', [6, 6, 5], 16)];
    expect(advise(sessions)).toMatchObject({ status: 'down', weight: 16, suggested: 14 });
  });

  it('très loin sous la fourchette dès la première fois : on baisse', () => {
    expect(advise([session('2026-11-10', [4, 4, 3])])).toMatchObject({ status: 'down', suggested: 70 });
  });

  it('stagnation : aucun progrès depuis 3 séances', () => {
    const sessions = [
      session('2026-10-20', [10, 10, 10]),
      session('2026-10-27', [10, 9, 9]),
      session('2026-11-03', [9, 9, 9]),
      session('2026-11-10', [10, 9, 8]),
    ];
    expect(advise(sessions)).toMatchObject({ status: 'plateau', suggested: 70 });
    // Un progrès récent écarte la stagnation.
    sessions[3] = session('2026-11-10', [11, 10, 10]);
    expect(advise(sessions)?.status).toBe('keep');
  });

  it('seule la charge la plus lourde de la séance est jugée', () => {
    const mixed: WorkSession = {
      date: '2026-11-10',
      sets: [
        { weight: 85, reps: 12, rpe: null },
        { weight: 85, reps: 12, rpe: null },
        { weight: 70, reps: 6, rpe: null },
      ],
    };
    expect(advise([mixed])).toMatchObject({ status: 'up', weight: 85, reps: [12, 12], suggested: 87.5 });
  });

  it('au poids du corps : ajouter du lest', () => {
    expect(advise([session('2026-11-10', [12, 12, 12], 0)])).toMatchObject({ status: 'up', suggested: 2.5 });
    expect(advise([session('2026-11-10', [3, 2, 2], 0)])).toMatchObject({ status: 'down', suggested: null });
  });

  it('respecte la fourchette et le pas donnés', () => {
    expect(advise([session('2026-11-10', [5, 5, 5], 100)], 3, 5, 5)).toMatchObject({ status: 'up', suggested: 105 });
    expect(floorToStep(72, 2.5)).toBe(70);
    expect(floorToStep(67.5, 1.25)).toBe(67.5);
    expect(advise([])).toBeNull();
  });
});

describe('répartition du volume', () => {
  const row = (date: string, primary: 'pectoraux' | 'dos' | 'quadriceps', secondary: ('triceps' | 'biceps')[] = []) => ({
    date,
    primary,
    secondary,
  });

  it('séries par semaine, muscle secondaire à moitié, comparées à l’objectif', () => {
    const rows = [
      ...Array.from({ length: 24 }, () => row('2026-11-10', 'pectoraux', ['triceps'])),
      ...Array.from({ length: 8 }, () => row('2026-11-12', 'dos', ['biceps'])),
      row('2026-09-01', 'quadriceps'), // trop ancien
    ];
    const report = volumeReport({ rows, today: '2026-11-17', firstDate: '2026-10-01', goal: 'muscle' });
    expect(report.weeks).toBe(4);
    expect(report.target).toEqual([10, 20]);
    expect(report.muscles).toEqual([
      { muscle: 'pectoraux', perWeek: 6, status: 'low' },
      { muscle: 'triceps', perWeek: 3, status: 'low' },
      { muscle: 'dos', perWeek: 2, status: 'low' },
      { muscle: 'biceps', perWeek: 1, status: 'low' },
    ]);
    expect(report.neglected).toEqual(['epaules', 'quadriceps', 'ischios', 'fessiers', 'mollets', 'abdominaux']);
    expect(report.alerts).toContain('more-push');
    expect(report.alerts).toContain('legs-low');
  });

  it('les premières semaines, la moyenne se fait sur les semaines écoulées', () => {
    const rows = Array.from({ length: 12 }, () => row('2026-11-15', 'pectoraux'));
    const report = volumeReport({ rows, today: '2026-11-17', firstDate: '2026-11-15', goal: 'force' });
    expect(report.weeks).toBe(1);
    expect(report.muscles[0]).toEqual({ muscle: 'pectoraux', perWeek: 12, status: 'ok' });
  });

  it('sans aucune séance : rien à signaler', () => {
    const report = volumeReport({ rows: [], today: '2026-11-17', firstDate: null, goal: 'muscle' });
    expect(report).toMatchObject({ muscles: [], neglected: [], alerts: [] });
  });
});

describe('records à venir', () => {
  const today = '2026-11-17';
  const day = (n: number) => localDate(new Date(`${today}T12:00:00`).getTime() - n * DAY_MS);
  const point = (daysAgo: number, e1rm: number) => ({
    date: day(daysAgo),
    sessionId: `s${daysAgo}`,
    maxWeight: 80,
    e1rm,
    volume: 0,
    bestSet: { weight: 80, reps: 8 },
  });
  const records: RepMax[] = [
    { reps: 1, weight: 95, date: '2026-10-01' },
    { reps: 3, weight: 90, date: '2026-10-01' },
    { reps: 5, weight: 85, date: '2026-10-01' },
    { reps: 8, weight: 80, date: '2026-10-01' },
    { reps: 10, weight: 72.5, date: '2026-10-01' },
  ];

  it('record à portée, dans la fourchette travaillée', () => {
    // 1RM estimé récent 110 kg : 110 / (1 + 10/30) = 82,5 kg pour 10 rép. (record : 72,5 kg).
    const forecast = prForecast({ points: [point(3, 110)], repMax: records, repMin: 8, repMax_: 12, step: 2.5, today });
    expect(forecast.candidate).toMatchObject({ reps: 10, weight: 82.5, record: { weight: 72.5 } });
  });

  it('pas de record proposé hors de la fourchette travaillée, ni sans séance récente', () => {
    const lowReps = records.map((r) => (r.reps >= 8 ? { ...r, weight: 200 } : r));
    expect(
      prForecast({ points: [point(3, 110)], repMax: lowReps, repMin: 8, repMax_: 12, step: 2.5, today }).candidate,
    ).toBeNull();
    expect(
      prForecast({ points: [point(60, 110)], repMax: records, repMin: 8, repMax_: 12, step: 2.5, today }).candidate,
    ).toBeNull();
  });

  it('projection du 1RM estimé jusqu’au prochain palier de 5 kg', () => {
    // +1 kg par semaine : 98 aujourd'hui, palier 100 dans environ 2 semaines.
    const points = [point(28, 94), point(21, 95), point(14, 96), point(7, 97), point(0, 98)];
    const { projection } = prForecast({ points, repMax: records, repMin: 8, repMax_: 12, step: 2.5, today });
    expect(projection).toEqual({ milestone: 100, date: day(-14), perWeek: 1 });
  });

  it('pas de projection si la courbe stagne ou descend', () => {
    const flat = [point(28, 98), point(14, 98), point(0, 98)];
    expect(prForecast({ points: flat, repMax: records, repMin: 8, repMax_: 12, step: 2.5, today }).projection).toBeNull();
    const down = [point(28, 100), point(14, 98), point(0, 96)];
    expect(prForecast({ points: down, repMax: records, repMin: 8, repMax_: 12, step: 2.5, today }).projection).toBeNull();
  });
});

describe('rapport complet', () => {
  const BENCH = 'ex-developpe-couche-barre';
  const CURL = 'ex-curl-halteres';

  async function setup() {
    const db = await freshDb();
    await seedBuiltinExercises(db);
    const program = await createProgram('Programme', db);
    const workout = await addWorkout(program.id, 'Haut', db);
    const bench = await addPlannedExercise(workout.id, BENCH, db);
    await updatePlannedExercise(workout.id, bench.id, { repMin: 6, repMax: 8 }, db);
    return { db, workoutId: workout.id };
  }

  async function doSession(db: AppDB, workoutId: string | null, plan: [string, [number, number, SetType][]][], daysAgo: number) {
    const s = await startSession(workoutId, db);
    let detail = (await getSessionDetail(s.id, db))!;
    for (const [exerciseId] of plan) {
      if (!detail.exercises.some((e) => e.exercise.exerciseId === exerciseId)) {
        const { addSessionExercise } = await import('./sessions');
        await addSessionExercise(s.id, exerciseId, db);
      }
    }
    detail = (await getSessionDetail(s.id, db))!;
    for (const [exerciseId, sets] of plan) {
      const exercise = detail.exercises.find((e) => e.exercise.exerciseId === exerciseId)!;
      const { addSet } = await import('./sessions');
      while (exercise.sets.length < sets.length) exercise.sets.push(await addSet(exercise.exercise.id, db));
      for (const [i, [weight, reps, type]] of sets.entries()) {
        await updateSet(exercise.sets[i].id, { weight, reps, type }, db);
        await completeSet(exercise.sets[i].id, s.startedAt + i * 60_000, db);
      }
    }
    await finishSession(s.id, s.startedAt + 3_000_000, db);
    if (daysAgo > 0) await setSessionDate(s.id, localDate(Date.now() - daysAgo * DAY_MS), Date.now(), db);
  }

  it('fourchette du programme, sinon celle de l’objectif ; drop sets et échauffements ignorés', async () => {
    const { db, workoutId } = await setup();
    await doSession(
      db,
      workoutId,
      [
        [BENCH, [[40, 10, 'warmup'], [90, 8, 'normal'], [90, 8, 'normal'], [90, 8, 'normal'], [70, 12, 'drop']]],
        [CURL, [[14, 10, 'normal'], [14, 9, 'normal']]],
      ],
      2,
    );
    const report = await getCoachReport(Date.now(), db);
    const bench = report.exercises.find((e) => e.exerciseId === BENCH)!;
    const curl = report.exercises.find((e) => e.exerciseId === CURL)!;

    expect(bench).toMatchObject({ repMin: 6, repMax: 8, fromProgram: true });
    expect(bench.advice).toMatchObject({ status: 'up', weight: 90, reps: [8, 8, 8], suggested: 92.5 });
    expect(curl).toMatchObject({ repMin: 8, repMax: 12, fromProgram: false });
    expect(curl.advice.status).toBe('keep');
    // Les conseils prêts à appliquer passent en premier.
    expect(report.exercises[0].exerciseId).toBe(BENCH);
    expect(report.totalSessions).toBe(1);
    expect(report.sessionsPerWeek).toBe(1);
    db.close();
  });

  it('l’objectif change la fourchette par défaut et le volume conseillé', async () => {
    const { db } = await setup();
    await doSession(db, null, [[CURL, [[14, 6, 'normal'], [14, 6, 'normal']]]], 1);
    expect((await getCoachReport(Date.now(), db)).exercises[0].advice.status).toBe('keep'); // 6 rép. < 8, une seule fois

    await setSetting('goal', 'force', db);
    const report = await getCoachReport(Date.now(), db);
    expect(report.goal).toBe('force');
    expect(report.exercises[0]).toMatchObject({ repMin: 3, repMax: 6 });
    expect(report.exercises[0].advice).toMatchObject({ status: 'up', suggested: 16.5 });
    expect(report.volume.target).toEqual([6, 12]);
    db.close();
  });

  it('évolution du volume sur 4 semaines, exercices trop anciens écartés', async () => {
    const { db, workoutId } = await setup();
    await doSession(db, workoutId, [[BENCH, [[100, 6, 'normal']]]], 40);
    await doSession(db, workoutId, [[BENCH, [[100, 7, 'normal']]]], 3);
    await doSession(db, null, [[CURL, [[10, 10, 'normal']]]], 70);
    const report = await getCoachReport(Date.now(), db);
    expect(report.volumeChange).toBe(17); // 700 contre 600
    expect(report.exercises.map((e) => e.exerciseId)).toEqual([BENCH]);
    db.close();
  });

  it('sans séance : rapport vide', async () => {
    const { db } = await setup();
    expect(await getCoachReport(Date.now(), db)).toMatchObject({
      totalSessions: 0,
      sessionsPerWeek: 0,
      volumeChange: null,
      exercises: [],
    });
    db.close();
  });
});
