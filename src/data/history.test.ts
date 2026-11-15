import { describe, expect, it } from 'vitest';
import type { AppDB } from './db';
import { seedBuiltinExercises } from './exercises';
import {
  addDoneSet,
  deleteSession,
  listHistory,
  monthWeeks,
  removeHistorySet,
  setSessionDate,
} from './history';
import { addPlannedExercise, addWorkout, createProgram, getProgram, getWorkout } from './programs';
import {
  completeSet,
  finishSession,
  getSessionDetail,
  getSessionScreenData,
  getSessionSummary,
  startSession,
  updateSet,
} from './sessions';
import { AppError, DAY_MS, localDate } from './util';
import { dumpOf, freshDb } from '../test/helpers';

const BENCH = 'ex-developpe-couche-barre';
const CURL = 'ex-curl-halteres';

async function setup() {
  const db = await freshDb();
  await seedBuiltinExercises(db);
  const program = await createProgram('Programme', db);
  const a = await addWorkout(program.id, 'Upper A', db);
  await addPlannedExercise(a.id, BENCH, db);
  await addPlannedExercise(a.id, CURL, db);
  return { db, program, a };
}

/** Fait une séance terminée : développé couché (lifts) puis une série de curl. */
async function doSession(db: AppDB, workoutId: string, lifts: [number, number][], daysAgo: number) {
  const session = await startSession(workoutId, db);
  const { exercises } = (await getSessionDetail(session.id, db))!;
  const t = session.startedAt;
  for (const [index, [weight, reps]] of lifts.entries()) {
    await updateSet(exercises[0].sets[index].id, { weight, reps }, db);
    await completeSet(exercises[0].sets[index].id, t + (index + 1) * 60_000, db);
  }
  await updateSet(exercises[1].sets[0].id, { weight: 12, reps: 10 }, db);
  await completeSet(exercises[1].sets[0].id, t + 600_000, db);
  await finishSession(session.id, t + 1_200_000, db);
  if (daysAgo > 0) await setSessionDate(session.id, localDate(t - daysAgo * DAY_MS), Date.now(), db);
  return session.id;
}

describe('liste de l’historique', () => {
  it('séances terminées, de la plus récente à la plus ancienne, avec leurs totaux', async () => {
    const { db, a } = await setup();
    const old = await doSession(db, a.id, [[80, 8], [80, 7]], 7);
    const recent = await doSession(db, a.id, [[82.5, 8]], 0);
    await startSession(a.id, db); // une séance en cours n'est pas dans l'historique

    const history = await listHistory(db);
    expect(history.map((h) => h.session.id)).toEqual([recent, old]);
    expect(history[1].totals).toEqual({ durationSec: 1200, volume: 80 * 15 + 120, setCount: 3 });
    expect(history[1].exerciseNames).toEqual(['Développé couché (barre)', 'Curl haltères']);
    db.close();
  });
});

describe('supprimer une séance', () => {
  it('efface la séance et ses séries, sans toucher au reste', async () => {
    const { db, program, a } = await setup();
    const kept = await doSession(db, a.id, [[80, 8]], 7);
    const removed = await doSession(db, a.id, [[82.5, 8]], 0);
    const keptBefore = await getSessionDetail(kept, db);
    const programBefore = [await getProgram(program.id, db), await getWorkout(a.id, db)];

    await deleteSession(removed, db);
    expect((await listHistory(db)).map((h) => h.session.id)).toEqual([kept]);
    expect(await db.sets.where('sessionId').equals(removed).count()).toBe(0);
    expect(await db.sessionExercises.where('sessionId').equals(removed).count()).toBe(0);
    expect(await getSessionDetail(kept, db)).toEqual(keptBefore);
    expect([await getProgram(program.id, db), await getWorkout(a.id, db)]).toEqual(programBefore);
    db.close();
  });

  it('refuse une séance en cours ou inexistante', async () => {
    const { db, a } = await setup();
    const active = await startSession(a.id, db);
    await expect(deleteSession(active.id, db)).rejects.toThrow(AppError);
    await expect(deleteSession('inconnue', db)).rejects.toThrow(AppError);
    expect(await db.sessions.count()).toBe(1);
    db.close();
  });

  it('supprimer une séance retire ses records : la suivante est rejugée sans elle', async () => {
    const { db, a } = await setup();
    const first = await doSession(db, a.id, [[80, 8]], 14);
    await doSession(db, a.id, [[90, 8]], 7);
    const last = await doSession(db, a.id, [[85, 8]], 0);
    const records = async () => (await getSessionSummary(last, db))!.records.map((r) => r.kinds);

    expect(await records()).toEqual([]); // 85 kg ne bat pas les 90 kg de la semaine d'avant
    const second = (await listHistory(db))[1].session.id;
    await deleteSession(second, db);
    expect(await records()).toEqual([['weight', 'e1rm']]); // sans elle, 85 kg bat les 80 kg
    expect((await listHistory(db)).map((h) => h.session.id)).toEqual([last, first]);
    db.close();
  });
});

describe('corriger une séance', () => {
  it('modifier une série change les totaux, sans propager aux autres séries', async () => {
    const { db, a } = await setup();
    const id = await doSession(db, a.id, [[80, 8], [80, 8]], 0);
    const [bench] = (await getSessionDetail(id, db))!.exercises;
    await updateSet(bench.sets[0].id, { weight: 100, reps: 5, rpe: 9, type: 'failure' }, db);

    const after = (await getSessionDetail(id, db))!.exercises[0].sets;
    expect(after.map((s) => [s.weight, s.reps, s.done])).toEqual([
      [100, 5, true],
      [80, 8, true],
    ]);
    expect((await listHistory(db))[0].totals.volume).toBe(500 + 640 + 120);
    db.close();
  });

  it('ajouter une série validée, copiée sur la précédente', async () => {
    const { db, a } = await setup();
    const id = await doSession(db, a.id, [[80, 8]], 0);
    const [bench] = (await getSessionDetail(id, db))!.exercises;
    const added = await addDoneSet(bench.exercise.id, db);
    expect(added).toMatchObject({ weight: 80, reps: 8, done: true, order: 1, type: 'normal' });
    expect(added.completedAt).toBe(bench.sets[0].completedAt);
    expect((await listHistory(db))[0].totals.setCount).toBe(3);
    db.close();
  });

  it('retirer une série ; la dernière d’un exercice emporte l’exercice', async () => {
    const { db, a } = await setup();
    const id = await doSession(db, a.id, [[80, 8], [80, 7]], 0);
    const detail = async () => (await getSessionDetail(id, db))!.exercises;
    const [bench, curl] = await detail();

    await removeHistorySet(bench.sets[0].id, db);
    expect((await detail())[0].sets.map((s) => [s.reps, s.order])).toEqual([[7, 0]]);

    await removeHistorySet(bench.sets[1].id, db);
    expect((await detail()).map((e) => [e.exercise.exerciseId, e.exercise.order])).toEqual([[CURL, 0]]);

    // Une séance ne peut pas rester vide.
    await expect(removeHistorySet(curl.sets[0].id, db)).rejects.toThrow(AppError);
    expect((await detail())[0].sets).toHaveLength(1);
    db.close();
  });

  it('changer le jour garde les heures et la durée', async () => {
    const { db, a } = await setup();
    const id = await doSession(db, a.id, [[80, 8]], 0);
    const before = (await getSessionDetail(id, db))!;
    const target = localDate(before.session.startedAt - 3 * DAY_MS);

    await setSessionDate(id, target, Date.now(), db);
    const after = (await getSessionDetail(id, db))!;
    const hours = (t: number) => [new Date(t).getHours(), new Date(t).getMinutes()];
    expect(after.session.date).toBe(target);
    expect(localDate(after.session.startedAt)).toBe(target);
    expect(hours(after.session.startedAt)).toEqual(hours(before.session.startedAt));
    expect(after.session.endedAt! - after.session.startedAt).toBe(1_200_000);
    expect(after.exercises[0].sets[0].completedAt! - after.session.startedAt).toBe(60_000);

    await expect(setSessionDate(id, '2026-02-30', Date.now(), db)).rejects.toThrow(AppError);
    await expect(setSessionDate(id, 'demain', Date.now(), db)).rejects.toThrow(AppError);
    await expect(
      setSessionDate(id, localDate(Date.now() + 2 * DAY_MS), Date.now(), db),
    ).rejects.toThrow(AppError);
    expect((await getSessionDetail(id, db))!.session.date).toBe(target);
    db.close();
  });

  it('une séance corrigée dans le passé sert de « dernière fois » selon sa nouvelle date', async () => {
    const { db, a } = await setup();
    const first = await doSession(db, a.id, [[80, 8]], 0);
    const second = await doSession(db, a.id, [[90, 6]], 0);
    // La deuxième est antidatée : elle passe avant la première.
    await setSessionDate(second, localDate(Date.now() - 10 * DAY_MS), Date.now(), db);
    await setSessionDate(first, localDate(Date.now() - 2 * DAY_MS), Date.now(), db);

    const current = await startSession(a.id, db);
    const screen = (await getSessionScreenData(current.id, db))!;
    expect(screen.exercises[0].history.last?.sets.map((s) => [s.weight, s.reps])).toEqual([[80, 8]]);
    db.close();
  });

  it('les corrections ne touchent ni au programme ni aux autres séances', async () => {
    const { db, a } = await setup();
    const other = await doSession(db, a.id, [[80, 8]], 7);
    const id = await doSession(db, a.id, [[82.5, 8], [82.5, 7]], 0);
    const untouched = async () => {
      const dump = await dumpOf(db);
      return [dump.programs, dump.programWorkouts, dump.exercises, await getSessionDetail(other, db)];
    };
    const before = await untouched();

    const [bench] = (await getSessionDetail(id, db))!.exercises;
    await updateSet(bench.sets[0].id, { weight: 60 }, db);
    await addDoneSet(bench.exercise.id, db);
    await removeHistorySet(bench.sets[1].id, db);
    await setSessionDate(id, localDate(Date.now() - DAY_MS), Date.now(), db);
    await deleteSession(id, db);
    expect(await untouched()).toEqual(before);
    db.close();
  });
});

describe('calendrier', () => {
  it('semaines du lundi au dimanche, cases vides hors du mois', () => {
    // Novembre 2026 commence un dimanche et finit un lundi.
    const weeks = monthWeeks(2026, 10);
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks[1][0]).toBe('2026-11-02');
    expect(weeks[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('février, années bissextiles ou non', () => {
    const days = (year: number) => monthWeeks(year, 1).flat().filter(Boolean).length;
    expect(days(2027)).toBe(28);
    expect(days(2028)).toBe(29);
    // Février 2027 commence un lundi : quatre semaines pleines.
    expect(monthWeeks(2027, 1)).toHaveLength(4);
  });
});
