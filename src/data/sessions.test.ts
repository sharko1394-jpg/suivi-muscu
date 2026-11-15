import { describe, expect, it } from 'vitest';
import { createDb, type AppDB } from './db';
import { seedBuiltinExercises } from './exercises';
import {
  addPlannedExercise,
  addWorkout,
  archiveProgram,
  createProgram,
  deleteProgram,
  deleteWorkout,
  getProgram,
  getWorkout,
  renameProgram,
  renameWorkout,
  setFixedDay,
  setScheduleMode,
  setSupersetWithNext,
  updatePlannedExercise,
} from './programs';
import {
  abandonSession,
  addSessionExercise,
  addSet,
  adjustRest,
  clearRest,
  completeSet,
  finishSession,
  getActiveSession,
  getSessionDetail,
  getSessionScreenData,
  getSessionSummary,
  getTodayState,
  prefillSets,
  removeSessionExercise,
  removeSet,
  replaceSessionExercise,
  setSessionExerciseNote,
  setSessionNote,
  skipPlannedWorkout,
  startSession,
  uncompleteSet,
  unskipToday,
  updateSet,
} from './sessions';
import { getSettings, setSetting } from './settings';
import { AppError, DAY_MS, localDate } from './util';
import { dumpOf, freshDb, freshName } from '../test/helpers';

const BENCH = 'ex-developpe-couche-barre';
const ROW = 'ex-rowing-barre';
const PULLUP = 'ex-tractions-pronation';
const CURL = 'ex-curl-halteres';

/** Programme en rotation : séance A (développé couché avec charge cible, rowing, tractions) et séance B. */
async function setup(database?: AppDB) {
  const db = database ?? (await freshDb());
  await seedBuiltinExercises(db);
  const program = await createProgram('Upper / Lower', db);
  const a = await addWorkout(program.id, 'Upper A', db);
  const b = await addWorkout(program.id, 'Lower A', db);
  const bench = await addPlannedExercise(a.id, BENCH, db);
  await updatePlannedExercise(a.id, bench.id, { targetWeight: 80, restSec: 150, note: 'banc 2' }, db);
  const row = await addPlannedExercise(a.id, ROW, db);
  await updatePlannedExercise(a.id, row.id, { sets: 2, repMin: 10, repMax: 12, restSec: 90 }, db);
  await addPlannedExercise(a.id, PULLUP, db);
  await addPlannedExercise(b.id, CURL, db);
  return { db, program, a, b };
}

const detailOf = async (db: AppDB, sessionId: string) => (await getSessionDetail(sessionId, db))!;

/** Valide toutes les séries d'un exercice avec la charge et les répétitions données. */
async function doSets(db: AppDB, sessionId: string, exerciseId: string, lifts: [number, number][], at = Date.now()) {
  const detail = await detailOf(db, sessionId);
  const { sets } = detail.exercises.find((e) => e.exercise.exerciseId === exerciseId)!;
  for (const [index, [weight, reps]] of lifts.entries()) {
    await updateSet(sets[index].id, { weight, reps }, db);
    await completeSet(sets[index].id, at + index * 60_000, db);
  }
}

/** Vieillit une séance terminée de `days` jours, comme si elle avait eu lieu avant. */
async function age(db: AppDB, sessionId: string, days: number) {
  const session = (await db.sessions.get(sessionId))!;
  const shift = days * DAY_MS;
  await db.sessions.update(sessionId, {
    startedAt: session.startedAt - shift,
    endedAt: session.endedAt === null ? null : session.endedAt - shift,
    date: localDate(session.startedAt - shift),
  });
  await db.sets
    .where('sessionId')
    .equals(sessionId)
    .modify((s) => {
      if (s.completedAt !== null) s.completedAt -= shift;
    });
}

describe('préremplissage des séries', () => {
  it('reprend la dernière performance, série par série', () => {
    const last = [
      { weight: 80, reps: 8 },
      { weight: 80, reps: 7 },
    ];
    expect(prefillSets({ count: 3, last, planned: { repMin: 10, targetWeight: 60 }, bodyweight: false })).toEqual([
      { weight: 80, reps: 8 },
      { weight: 80, reps: 7 },
      { weight: 80, reps: 7 }, // moins de séries la dernière fois : on répète la dernière
    ]);
  });

  it('sans historique : charge cible et bas de la fourchette', () => {
    expect(prefillSets({ count: 2, last: [], planned: { repMin: 8, targetWeight: 60 }, bodyweight: false })).toEqual([
      { weight: 60, reps: 8 },
      { weight: 60, reps: 8 },
    ]);
  });

  it('sans rien de connu : charge à saisir, ou 0 kg au poids du corps', () => {
    expect(prefillSets({ count: 1, last: [], planned: null, bodyweight: false })).toEqual([{ weight: null, reps: 10 }]);
    expect(prefillSets({ count: 1, last: [], planned: null, bodyweight: true })).toEqual([{ weight: 0, reps: 10 }]);
  });
});

describe('démarrer une séance', () => {
  it('copie le programme : noms, muscles, exercices prévus, séries préremplies', async () => {
    const { db, program, a } = await setup();
    const session = await startSession(a.id, db);
    expect(session).toMatchObject({
      status: 'inProgress',
      endedAt: null,
      programId: program.id,
      programName: 'Upper / Lower',
      workoutId: a.id,
      workoutName: 'Upper A',
      date: localDate(Date.now()),
    });

    const { exercises } = await detailOf(db, session.id);
    expect(exercises.map((e) => e.exercise.exerciseName)).toEqual([
      'Développé couché (barre)',
      'Rowing barre (buste penché)',
      'Tractions (pronation)',
    ]);
    expect(exercises[0].exercise).toMatchObject({
      primaryMuscle: 'pectoraux',
      equipment: 'barre',
      planned: { sets: 3, repMin: 8, repMax: 12, targetWeight: 80, restSec: 150, note: 'banc 2' },
    });
    // Charge cible, charge à saisir, poids du corps.
    expect(exercises[0].sets.map((s) => [s.weight, s.reps, s.done])).toEqual([
      [80, 8, false],
      [80, 8, false],
      [80, 8, false],
    ]);
    expect(exercises[1].sets.map((s) => [s.weight, s.reps])).toEqual([
      [null, 10],
      [null, 10],
    ]);
    expect(exercises[2].sets.map((s) => s.weight)).toEqual([0, 0, 0]);
    db.close();
  });

  it('une seule séance en cours à la fois', async () => {
    const { db, a, b } = await setup();
    await startSession(a.id, db);
    await expect(startSession(b.id, db)).rejects.toThrow(AppError);
    await expect(startSession(null, db)).rejects.toThrow(AppError);
    expect(await db.sessions.count()).toBe(1);
    db.close();
  });

  it('séance libre : vide, on y ajoute ce qu’on veut', async () => {
    const { db } = await setup();
    const session = await startSession(null, db);
    expect(session).toMatchObject({ programId: null, workoutId: null, workoutName: 'Séance libre' });
    const added = await addSessionExercise(session.id, CURL, db);
    expect(added).toMatchObject({ exerciseName: 'Curl haltères', planned: null, order: 0 });
    expect((await detailOf(db, session.id)).exercises[0].sets).toHaveLength(3);
    db.close();
  });

  it('la fois suivante, les champs reprennent la dernière performance (sans l’échauffement)', async () => {
    const { db, a } = await setup();
    const first = await startSession(a.id, db);
    const bench = (await detailOf(db, first.id)).exercises[0];
    await updateSet(bench.sets[0].id, { weight: 40, reps: 10, type: 'warmup' }, db);
    await completeSet(bench.sets[0].id, Date.now(), db);
    await updateSet(bench.sets[1].id, { weight: 82.5, reps: 8 }, db);
    await completeSet(bench.sets[1].id, Date.now(), db);
    await updateSet(bench.sets[2].id, { weight: 82.5, reps: 7 }, db);
    await completeSet(bench.sets[2].id, Date.now(), db);
    await finishSession(first.id, Date.now(), db);
    await age(db, first.id, 7);

    const second = await startSession(a.id, db);
    const again = (await detailOf(db, second.id)).exercises[0];
    expect(again.sets.map((s) => [s.weight, s.reps, s.type])).toEqual([
      [82.5, 8, 'normal'],
      [82.5, 7, 'normal'],
      [82.5, 7, 'normal'],
    ]);

    const screen = (await getSessionScreenData(second.id, db))!;
    expect(screen.exercises[0].history.last?.sets.map((s) => [s.weight, s.reps])).toEqual([
      [82.5, 8],
      [82.5, 7],
    ]);
    expect(screen.exercises[0].history.last?.date).toBe(localDate(Date.now() - 7 * DAY_MS));
    // Le rowing n'a pas été fait la dernière fois : rien à rappeler.
    expect(screen.exercises[1].history.last).toBeNull();
    db.close();
  });
});

describe('saisir les séries', () => {
  it('les valeurs restent dans les bornes', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const [set] = (await detailOf(db, session.id)).exercises[0].sets;
    await updateSet(set.id, { weight: 82.456, reps: 0, rpe: 8.3 }, db);
    expect(await db.sets.get(set.id)).toMatchObject({ weight: 82.46, reps: 1, rpe: 8.5 });
    await updateSet(set.id, { weight: -5, reps: 500, rpe: 99 }, db);
    expect(await db.sets.get(set.id)).toMatchObject({ weight: 0, reps: 100, rpe: 10 });
    await updateSet(set.id, { rpe: null, type: 'failure' }, db);
    expect(await db.sets.get(set.id)).toMatchObject({ rpe: null, type: 'failure' });
    await expect(updateSet(set.id, { weight: Number.NaN }, db)).rejects.toThrow(AppError);
    db.close();
  });

  it('changer la charge d’une série change les suivantes qui avaient la même', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const weights = async () => (await detailOf(db, session.id)).exercises[0].sets.map((s) => s.weight);
    const [s1, s2, s3] = (await detailOf(db, session.id)).exercises[0].sets;

    await updateSet(s1.id, { weight: 82.5 }, db);
    expect(await weights()).toEqual([82.5, 82.5, 82.5]);

    // Une série déjà faite, ou réglée à une autre charge, ne suit pas.
    await completeSet(s1.id, Date.now(), db);
    await updateSet(s3.id, { weight: 70 }, db);
    await updateSet(s2.id, { weight: 85 }, db);
    expect(await weights()).toEqual([82.5, 85, 70]);

    // Corriger une série déjà validée ne touche pas aux autres.
    await updateSet(s1.id, { weight: 80 }, db);
    expect(await weights()).toEqual([80, 85, 70]);
    db.close();
  });

  it('une charge à saisir se propage dès la première saisie', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const row = (await detailOf(db, session.id)).exercises[1];
    await updateSet(row.sets[0].id, { weight: 60 }, db);
    expect((await detailOf(db, session.id)).exercises[1].sets.map((s) => s.weight)).toEqual([60, 60]);
    db.close();
  });

  it('valider exige une charge, enregistre l’heure et lance le repos de l’exercice', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const { exercises } = await detailOf(db, session.id);
    const now = Date.now();

    await expect(completeSet(exercises[1].sets[0].id, now, db)).rejects.toThrow(AppError);
    expect((await db.sets.get(exercises[1].sets[0].id))?.done).toBe(false);

    const result = await completeSet(exercises[0].sets[0].id, now, db);
    expect(result).toEqual({ nextSetId: exercises[0].sets[1].id, restSec: 150 });
    expect(await db.sets.get(exercises[0].sets[0].id)).toMatchObject({ done: true, completedAt: now });
    expect((await getSettings(db)).restTimer).toEqual({ endsAt: now + 150_000, totalSec: 150 });
    db.close();
  });

  it('annuler une validation, ajouter et retirer une série', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const bench = (await detailOf(db, session.id)).exercises[0];
    await completeSet(bench.sets[0].id, Date.now(), db);
    await uncompleteSet(bench.sets[0].id, db);
    expect(await db.sets.get(bench.sets[0].id)).toMatchObject({ done: false, completedAt: null });

    await updateSet(bench.sets[2].id, { weight: 75, reps: 6 }, db);
    const added = await addSet(bench.exercise.id, db);
    expect(added).toMatchObject({ order: 3, weight: 75, reps: 6, type: 'normal', done: false });

    await removeSet(bench.sets[1].id, db);
    const after = (await detailOf(db, session.id)).exercises[0].sets;
    expect(after.map((s) => s.order)).toEqual([0, 1, 2]);
    expect(after.map((s) => s.id)).toEqual([bench.sets[0].id, bench.sets[2].id, added.id]);

    // On ne retire pas la dernière série d'un exercice.
    for (const s of after.slice(1)) await removeSet(s.id, db);
    await expect(removeSet(after[0].id, db)).rejects.toThrow(AppError);
    db.close();
  });

  it('superset : pas de repos entre les deux exercices, repos après le second', async () => {
    const { db, a } = await setup();
    const [benchItem] = (await getWorkout(a.id, db))!.items;
    await setSupersetWithNext(a.id, benchItem.id, true, db);
    const session = await startSession(a.id, db);
    const { exercises } = await detailOf(db, session.id);
    await updateSet(exercises[1].sets[0].id, { weight: 60 }, db);
    const now = Date.now();

    const afterBench = await completeSet(exercises[0].sets[0].id, now, db);
    expect(afterBench).toEqual({ nextSetId: exercises[1].sets[0].id, restSec: 0 });
    expect((await getSettings(db)).restTimer).toBeNull();

    const afterRow = await completeSet(exercises[1].sets[0].id, now, db);
    expect(afterRow).toEqual({ nextSetId: exercises[0].sets[1].id, restSec: 90 });
    db.close();
  });

  it('le minuteur se règle et s’arrête', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const [set] = (await detailOf(db, session.id)).exercises[0].sets;
    const now = Date.now();
    await completeSet(set.id, now, db);

    await adjustRest(15, now, db);
    expect((await getSettings(db)).restTimer).toEqual({ endsAt: now + 165_000, totalSec: 165 });
    await adjustRest(-600, now, db);
    expect((await getSettings(db)).restTimer).toEqual({ endsAt: now, totalSec: 0 });
    await clearRest(db);
    expect((await getSettings(db)).restTimer).toBeNull();
    await adjustRest(15, now, db); // sans minuteur en cours : sans effet
    expect((await getSettings(db)).restTimer).toBeNull();
    db.close();
  });
});

describe('modifier la séance en cours', () => {
  it('ajouter un exercice non prévu, puis le retirer', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const added = await addSessionExercise(session.id, CURL, db);
    expect(added.order).toBe(3);
    await removeSessionExercise((await detailOf(db, session.id)).exercises[1].exercise.id, db);
    const { exercises } = await detailOf(db, session.id);
    expect(exercises.map((e) => [e.exercise.exerciseId, e.exercise.order])).toEqual([
      [BENCH, 0],
      [PULLUP, 1],
      [CURL, 2],
    ]);
    expect(await db.sets.where('exerciseId').equals(ROW).count()).toBe(0);
    db.close();
  });

  it('remplacer pour cette séance seulement : le programme ne change pas', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const bench = (await detailOf(db, session.id)).exercises[0];
    await replaceSessionExercise(bench.exercise.id, CURL, false, db);

    const { exercises } = await detailOf(db, session.id);
    expect(exercises.map((e) => e.exercise.exerciseId)).toEqual([CURL, ROW, PULLUP]);
    expect(exercises[0].exercise).toMatchObject({
      exerciseName: 'Curl haltères',
      primaryMuscle: 'biceps',
      // Séries, répétitions et repos gardés ; charge cible et note de l'ancien exercice effacées.
      planned: { sets: 3, repMin: 8, repMax: 12, restSec: 150, targetWeight: null, note: '' },
    });
    expect(exercises[0].sets.map((s) => [s.weight, s.reps, s.exerciseId])).toEqual([
      [null, 8, CURL],
      [null, 8, CURL],
      [null, 8, CURL],
    ]);
    expect((await getWorkout(a.id, db))!.items.map((i) => i.exerciseId)).toEqual([BENCH, ROW, PULLUP]);
    db.close();
  });

  it('remplacer définitivement : le programme change aussi', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const bench = (await detailOf(db, session.id)).exercises[0];
    await replaceSessionExercise(bench.exercise.id, CURL, true, db);
    const items = (await getWorkout(a.id, db))!.items;
    expect(items.map((i) => i.exerciseId)).toEqual([CURL, ROW, PULLUP]);
    expect(items[0]).toMatchObject({ sets: 3, restSec: 150, targetWeight: null, note: '' });
    db.close();
  });

  it('remplacer après des séries validées : elles restent, le nouvel exercice prend la suite', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const bench = (await detailOf(db, session.id)).exercises[0];
    await completeSet(bench.sets[0].id, Date.now(), db);
    await replaceSessionExercise(bench.exercise.id, CURL, false, db);

    const { exercises } = await detailOf(db, session.id);
    expect(exercises.map((e) => e.exercise.exerciseId)).toEqual([BENCH, CURL, ROW, PULLUP]);
    expect(exercises[0].sets.map((s) => s.done)).toEqual([true]);
    expect(exercises[1].sets).toHaveLength(2);
    expect(exercises.map((e) => e.exercise.order)).toEqual([0, 1, 2, 3]);
    db.close();
  });

  it('notes de séance et d’exercice', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const bench = (await detailOf(db, session.id)).exercises[0];
    await setSessionNote(session.id, 'En forme', db);
    await setSessionExerciseNote(bench.exercise.id, 'Prise large', db);
    const detail = await detailOf(db, session.id);
    expect(detail.session.note).toBe('En forme');
    expect(detail.exercises[0].exercise.note).toBe('Prise large');
    db.close();
  });
});

describe('terminer ou abandonner', () => {
  it('terminer ne garde que ce qui a été fait', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const start = session.startedAt;
    await doSets(db, session.id, BENCH, [[80, 8], [80, 7]], start + 60_000);
    await doSets(db, session.id, PULLUP, [[0, 9]], start + 600_000);

    expect(await finishSession(session.id, start + 700_000, db)).toBe('saved');
    const detail = await detailOf(db, session.id);
    expect(detail.session).toMatchObject({ status: 'done', endedAt: start + 700_000 });
    // Le rowing, jamais commencé, et les séries non validées disparaissent.
    expect(detail.exercises.map((e) => [e.exercise.exerciseId, e.exercise.order, e.sets.length])).toEqual([
      [BENCH, 0, 2],
      [PULLUP, 1, 1],
    ]);
    expect(detail.exercises.flatMap((e) => e.sets).every((s) => s.done)).toBe(true);
    expect(await getActiveSession(db)).toBeUndefined();
    expect((await getSettings(db)).restTimer).toBeNull();
    await expect(finishSession(session.id, Date.now(), db)).rejects.toThrow(AppError);
    db.close();
  });

  it('sans aucune série validée, rien n’est enregistré', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    expect(await finishSession(session.id, Date.now(), db)).toBe('discarded');
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sessionExercises.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
    db.close();
  });

  it('une séance oubliée ouverte s’arrête à sa dernière série', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    const start = session.startedAt;
    await doSets(db, session.id, BENCH, [[80, 8]], start + 300_000);
    await finishSession(session.id, start + 2 * DAY_MS, db);
    expect((await db.sessions.get(session.id))?.endedAt).toBe(start + 300_000);
    db.close();
  });

  it('abandonner efface la séance en cours', async () => {
    const { db, a } = await setup();
    const session = await startSession(a.id, db);
    await doSets(db, session.id, BENCH, [[80, 8]]);
    await abandonSession(session.id, db);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
    expect((await getSettings(db)).restTimer).toBeNull();
    db.close();
  });

  it('rotation : après une séance, la prochaine est la suivante du cycle', async () => {
    const { db, program, a, b } = await setup();
    const next = async () => {
      const p = (await getProgram(program.id, db))!;
      return p.rotation[p.nextRotationIndex];
    };
    expect(await next()).toBe(a.id);

    const first = await startSession(a.id, db);
    await doSets(db, first.id, BENCH, [[80, 8]]);
    await finishSession(first.id, Date.now(), db);
    expect(await next()).toBe(b.id);

    // On refait A alors que B était prévue : le cycle repart de A, donc B ensuite.
    const second = await startSession(a.id, db);
    await doSets(db, second.id, BENCH, [[80, 8]]);
    await finishSession(second.id, Date.now(), db);
    expect(await next()).toBe(b.id);

    const third = await startSession(b.id, db);
    await doSets(db, third.id, CURL, [[12, 10]]);
    await finishSession(third.id, Date.now(), db);
    expect(await next()).toBe(a.id);

    // Une séance écartée (rien de validé) ou libre ne fait pas avancer le cycle.
    await finishSession((await startSession(a.id, db)).id, Date.now(), db);
    const free = await startSession(null, db);
    await addSessionExercise(free.id, CURL, db);
    await doSets(db, free.id, CURL, [[12, 10]]);
    await finishSession(free.id, Date.now(), db);
    expect(await next()).toBe(a.id);
    db.close();
  });
});

describe('reprendre après une fermeture de l’appli', () => {
  it('la séance, les séries validées et le minuteur sont retrouvés tels quels', async () => {
    const name = freshName();
    const before = createDb(name);
    await before.open();
    const { a } = await setup(before);
    const session = await startSession(a.id, before);
    const bench = (await detailOf(before, session.id)).exercises[0];
    await updateSet(bench.sets[0].id, { weight: 82.5, reps: 9, rpe: 8 }, before);
    const now = Date.now();
    await completeSet(bench.sets[0].id, now, before);
    await updateSet(bench.sets[1].id, { reps: 7 }, before);
    await setSessionNote(session.id, 'Épaule un peu raide', before);
    const expected = await dumpOf(before);
    before.close(); // l'appli est fermée en pleine séance

    const after = createDb(name);
    await after.open();
    expect(await dumpOf(after)).toEqual(expected);
    const resumed = (await getActiveSession(after))!;
    expect(resumed.id).toBe(session.id);
    const sets = (await detailOf(after, resumed.id)).exercises[0].sets;
    expect(sets.map((s) => [s.weight, s.reps, s.rpe, s.done])).toEqual([
      [82.5, 9, 8, true],
      [82.5, 7, null, false],
      [82.5, 8, null, false],
    ]);
    expect((await getSettings(after)).restTimer).toEqual({ endsAt: now + 150_000, totalSec: 150 });
    expect(resumed.note).toBe('Épaule un peu raide');
    after.close();
  });
});

describe('règle essentielle, avec une vraie séance', () => {
  it('modifier puis supprimer le programme laisse la séance réalisée intacte', async () => {
    const { db, program, a } = await setup();
    const session = await startSession(a.id, db);
    await doSets(db, session.id, BENCH, [[80, 8], [80, 8], [80, 7]]);
    await finishSession(session.id, Date.now(), db);
    const before = await detailOf(db, session.id);

    const [benchItem] = (await getWorkout(a.id, db))!.items;
    await renameProgram(program.id, 'Autre nom', db);
    await renameWorkout(a.id, 'Autre séance', db);
    await updatePlannedExercise(a.id, benchItem.id, { sets: 6, targetWeight: 20, note: 'changé' }, db);
    await deleteWorkout(a.id, db);
    await archiveProgram(program.id, db);
    await deleteProgram(program.id, db);

    const after = await detailOf(db, session.id);
    expect(after).toEqual(before);
    expect(after.session).toMatchObject({ programName: 'Upper / Lower', workoutName: 'Upper A' });
    expect(after.exercises[0].exercise.planned).toMatchObject({ sets: 3, targetWeight: 80, note: 'banc 2' });
    db.close();
  });
});

describe('records et bilan', () => {
  async function twoSessions() {
    const ctx = await setup();
    const { db, a } = ctx;
    const first = await startSession(a.id, db);
    const t1 = first.startedAt;
    await doSets(db, first.id, BENCH, [[80, 8], [80, 8], [80, 7]], t1 + 60_000);
    await doSets(db, first.id, PULLUP, [[0, 8]], t1 + 600_000);
    await finishSession(first.id, t1 + 1_800_000, db);
    await age(db, first.id, 7);

    const second = await startSession(a.id, db);
    const t2 = second.startedAt;
    await doSets(db, second.id, BENCH, [[80, 9], [82.5, 8], [80, 8]], t2 + 60_000);
    await doSets(db, second.id, PULLUP, [[0, 8], [0, 10]], t2 + 600_000);
    return { ...ctx, first, second, t2 };
  }

  it('badge « Record » en direct pendant la séance', async () => {
    const { db, second } = await twoSessions();
    const screen = (await getSessionScreenData(second.id, db))!;
    const bench = screen.exercises[0];
    const pullups = screen.exercises[2];
    const kinds = (e: typeof bench) => e.sets.map((s) => e.records.get(s.id) ?? []);

    expect(kinds(bench)).toEqual([
      ['e1rm', 'reps'], // 80 × 9 : une répétition de plus que jamais à 80 kg
      ['weight', 'e1rm'], // 82,5 × 8 : charge la plus lourde
      [], // 80 × 8 : déjà fait
    ]);
    expect(kinds(pullups)).toEqual([[], ['reps'], []]);
    db.close();
  });

  it('bilan : durée, volume, records, comparaison avec la fois précédente', async () => {
    const { db, first, second, t2 } = await twoSessions();
    await finishSession(second.id, t2 + 2_400_000, db);
    const summary = (await getSessionSummary(second.id, db))!;

    expect(summary.totals).toEqual({
      durationSec: 2400,
      volume: 80 * 9 + 82.5 * 8 + 80 * 8,
      setCount: 5,
    });
    expect(summary.records.map((r) => [r.exerciseName, r.weight, r.reps, r.kinds])).toEqual([
      ['Développé couché (barre)', 80, 9, ['e1rm', 'reps']],
      ['Développé couché (barre)', 82.5, 8, ['weight', 'e1rm']],
      ['Tractions (pronation)', 0, 10, ['reps']],
    ]);
    expect(summary.previous?.session.id).toBe(first.id);
    expect(summary.previous?.totals).toEqual({ durationSec: 1800, volume: 80 * 23, setCount: 4 });
    expect(summary.exercises.map((e) => [e.name, e.volume, e.previousVolume])).toEqual([
      ['Développé couché (barre)', 2020, 1840],
      ['Tractions (pronation)', 0, 0],
    ]);

    // La première séance n'a rien avant elle : ni comparaison, ni record.
    const firstSummary = (await getSessionSummary(first.id, db))!;
    expect(firstSummary.previous).toBeNull();
    expect(firstSummary.records).toEqual([]);
    db.close();
  });
});

describe('accueil : où en est-on aujourd’hui ?', () => {
  it('séance en cours et son avancement', async () => {
    const { db, a } = await setup();
    expect((await getTodayState(Date.now(), db)).active).toBeNull();
    const session = await startSession(a.id, db);
    await doSets(db, session.id, BENCH, [[80, 8]]);
    const state = await getTodayState(Date.now(), db);
    expect(state.active).toMatchObject({ session: { id: session.id }, doneSets: 1, totalSets: 8 });
    db.close();
  });

  it('rotation : passer la séance fait avancer le cycle', async () => {
    const { db, a, b } = await setup();
    const planned = async () => {
      const { plan } = await getTodayState(Date.now(), db);
      return plan.kind === 'workout' ? plan.workout.id : plan.kind;
    };
    expect(await planned()).toBe(a.id);
    await skipPlannedWorkout(Date.now(), db);
    expect(await planned()).toBe(b.id);
    await skipPlannedWorkout(Date.now(), db);
    expect(await planned()).toBe(a.id);
    db.close();
  });

  it('jours fixes : passer la séance du jour, se raviser, puis la faire', async () => {
    const { db, program, a } = await setup();
    const monday = new Date(2026, 10, 16, 18, 0).getTime();
    await setScheduleMode(program.id, 'fixedDays', db);
    await setFixedDay(program.id, 1, a.id, db);

    let state = await getTodayState(monday, db);
    expect(state).toMatchObject({ plan: { kind: 'workout' }, skipped: false, plannedDone: false });

    await skipPlannedWorkout(monday, db);
    expect((await getTodayState(monday, db)).skipped).toBe(true);
    // Le lendemain, on repart de zéro : mardi est un jour de repos.
    state = await getTodayState(monday + DAY_MS, db);
    expect(state).toMatchObject({ plan: { kind: 'rest' }, skipped: false });

    await unskipToday(db);
    expect((await getTodayState(monday, db)).skipped).toBe(false);

    // Démarrer la séance annule aussi le « passé ».
    await skipPlannedWorkout(monday, db);
    const session = await startSession(a.id, db);
    expect((await getSettings(db)).skippedDay).toBeNull();
    await doSets(db, session.id, BENCH, [[80, 8]]);
    await finishSession(session.id, Date.now(), db);
    await db.sessions.update(session.id, { date: localDate(monday) });

    state = await getTodayState(monday, db);
    expect(state.plannedDone).toBe(true);
    expect(state.doneToday.map((s) => s.id)).toEqual([session.id]);
    db.close();
  });

  it('sans programme : rien de prévu, mais une séance libre reste possible', async () => {
    const db = await freshDb();
    await seedBuiltinExercises(db);
    const state = await getTodayState(Date.now(), db);
    expect(state).toMatchObject({ program: null, plan: { kind: 'none' }, active: null, doneToday: [] });
    await setSetting('defaultRestSec', 60, db);
    const session = await startSession(null, db);
    const exercise = await addSessionExercise(session.id, CURL, db);
    const [set] = (await detailOf(db, session.id)).exercises[0].sets;
    await updateSet(set.id, { weight: 12 }, db);
    // Exercice non prévu : repos par défaut des réglages.
    expect((await completeSet(set.id, Date.now(), db)).restSec).toBe(60);
    expect(exercise.planned).toBeNull();
    db.close();
  });
});
