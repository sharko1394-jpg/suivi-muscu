import { describe, expect, it } from 'vitest';
import type { AppDB } from './db';
import { seedBuiltinExercises } from './exercises';
import {
  addPlannedExercise,
  addWorkout,
  archiveProgram,
  createProgram,
  deleteProgram,
  deleteWorkout,
  duplicateProgram,
  duplicateWorkout,
  getActiveProgram,
  getProgram,
  getWorkout,
  isLinkedWithNext,
  isoWeekday,
  listPrograms,
  listWorkouts,
  normalizeSupersets,
  plannedWorkoutFor,
  removePlannedExercise,
  renameProgram,
  renameWorkout,
  reorderPlannedExercises,
  reorderWorkouts,
  replacePlannedExercise,
  setActiveProgram,
  setFixedDay,
  setNextWorkout,
  setScheduleMode,
  setSupersetWithNext,
  unarchiveProgram,
  updatePlannedExercise,
} from './programs';
import { setSetting } from './settings';
import type { PlannedExercise } from './types';
import { AppError } from './util';
import { dumpOf, fillSampleData, freshDb } from '../test/helpers';

const BENCH = 'ex-developpe-couche-barre';
const ROW = 'ex-rowing-barre';
const CURL = 'ex-curl-halteres';
const SQUAT = 'ex-squat-barre';

async function setup(): Promise<AppDB> {
  const database = await freshDb();
  await seedBuiltinExercises(database);
  return database;
}

/** Programme avec trois séances A, B, C. */
async function programABC(database: AppDB) {
  const program = await createProgram('Mon programme', database);
  const a = await addWorkout(program.id, 'A', database);
  const b = await addWorkout(program.id, 'B', database);
  const c = await addWorkout(program.id, 'C', database);
  return { program, a, b, c };
}

const names = async (programId: string, database: AppDB) =>
  (await listWorkouts(programId, database)).map((w) => w.name);

describe('programmes', () => {
  it('le premier programme est actif, les suivants non', async () => {
    const database = await setup();
    const first = await createProgram('  Upper   Lower ', database);
    const second = await createProgram('PPL', database);
    expect(first.name).toBe('Upper Lower');
    expect(first.status).toBe('active');
    expect(second.status).toBe('inactive');
    database.close();
  });

  it('un seul programme actif à la fois', async () => {
    const database = await setup();
    const first = await createProgram('Un', database);
    const second = await createProgram('Deux', database);
    await setActiveProgram(second.id, database);
    expect((await getActiveProgram(database))?.id).toBe(second.id);
    expect((await getProgram(first.id, database))?.status).toBe('inactive');
    expect(await database.programs.where('status').equals('active').count()).toBe(1);
    database.close();
  });

  it('archiver, désarchiver, renommer', async () => {
    const database = await setup();
    const program = await createProgram('Un', database);
    await archiveProgram(program.id, database);
    expect(await getActiveProgram(database)).toBeUndefined();
    await unarchiveProgram(program.id, database);
    expect((await getProgram(program.id, database))?.status).toBe('inactive');
    await renameProgram(program.id, 'Nouveau nom', database);
    expect((await getProgram(program.id, database))?.name).toBe('Nouveau nom');
    await expect(renameProgram(program.id, '   ', database)).rejects.toThrow(AppError);
    await expect(createProgram('x'.repeat(61), database)).rejects.toThrow(AppError);
    database.close();
  });

  it('la liste met l’actif en premier, les archivés en dernier', async () => {
    const database = await setup();
    const z = await createProgram('Zeta', database);
    await createProgram('Alpha', database);
    const old = await createProgram('Ancien', database);
    await archiveProgram(old.id, database);
    await addWorkout(z.id, 'A', database);
    const list = await listPrograms(database);
    expect(list.map((p) => p.name)).toEqual(['Zeta', 'Alpha', 'Ancien']);
    expect(list[0].workoutCount).toBe(1);
    database.close();
  });

  it('on ne supprime qu’un programme archivé, avec ses séances', async () => {
    const database = await setup();
    const { program } = await programABC(database);
    await expect(deleteProgram(program.id, database)).rejects.toThrow(AppError);
    await archiveProgram(program.id, database);
    await deleteProgram(program.id, database);
    expect(await database.programs.count()).toBe(0);
    expect(await database.programWorkouts.count()).toBe(0);
    database.close();
  });

  it('dupliquer donne une copie indépendante', async () => {
    const database = await setup();
    const { program, a, b } = await programABC(database);
    const item = await addPlannedExercise(a.id, BENCH, database);
    await addPlannedExercise(a.id, ROW, database);
    await setSupersetWithNext(a.id, item.id, true, database);
    await setScheduleMode(program.id, 'fixedDays', database);
    await setFixedDay(program.id, 1, a.id, database);
    await setFixedDay(program.id, 4, b.id, database);

    const copy = await duplicateProgram(program.id, database);
    const copies = await listWorkouts(copy.id, database);
    expect(copy.name).toBe('Mon programme (copie)');
    expect(copy.status).toBe('inactive');
    expect(copies.map((w) => w.name)).toEqual(['A', 'B', 'C']);
    // Nouveaux identifiants partout, planification recopiée sur les nouvelles séances.
    expect(copies.map((w) => w.id)).not.toContain(a.id);
    expect(copy.fixedDays).toEqual({ 1: copies[0].id, 4: copies[1].id });
    expect(copy.rotation).toEqual(copies.map((w) => w.id));
    expect(copies[0].items.map((i) => i.exerciseId)).toEqual([BENCH, ROW]);
    expect(copies[0].items[0].id).not.toBe(item.id);
    expect(isLinkedWithNext(copies[0].items, 0)).toBe(true);

    // Modifier la copie ne change pas l'original.
    await updatePlannedExercise(copies[0].id, copies[0].items[0].id, { sets: 5 }, database);
    await deleteWorkout(copies[1].id, database);
    expect((await getWorkout(a.id, database))?.items[0].sets).toBe(3);
    expect(await names(program.id, database)).toEqual(['A', 'B', 'C']);
    database.close();
  });
});

describe('séances d’un programme', () => {
  it('ajouter, renommer, dupliquer, supprimer', async () => {
    const database = await setup();
    const { program, a, b } = await programABC(database);
    await renameWorkout(b.id, 'Lower', database);
    const copy = await duplicateWorkout(a.id, database);
    expect(copy.name).toBe('A (copie)');
    expect(await names(program.id, database)).toEqual(['A', 'A (copie)', 'Lower', 'C']);
    await deleteWorkout(a.id, database);
    expect(await names(program.id, database)).toEqual(['A (copie)', 'Lower', 'C']);
    expect((await listWorkouts(program.id, database)).map((w) => w.order)).toEqual([0, 1, 2]);
    await expect(addWorkout(program.id, '', database)).rejects.toThrow(AppError);
    database.close();
  });

  it('réordonner les séances', async () => {
    const database = await setup();
    const { program, a, b, c } = await programABC(database);
    await reorderWorkouts(program.id, [c.id, a.id, b.id], database);
    expect(await names(program.id, database)).toEqual(['C', 'A', 'B']);
    expect((await getProgram(program.id, database))?.rotation).toEqual([c.id, a.id, b.id]);
    // Une liste incomplète est refusée, rien ne bouge.
    await expect(reorderWorkouts(program.id, [a.id, b.id], database)).rejects.toThrow(AppError);
    expect(await names(program.id, database)).toEqual(['C', 'A', 'B']);
    database.close();
  });
});

describe('planification', () => {
  const monday = new Date(2026, 10, 16); // lundi 16 novembre 2026
  const sunday = new Date(2026, 10, 15);

  it('reconnaît les jours de la semaine (lundi = 1, dimanche = 7)', () => {
    expect(isoWeekday(monday)).toBe(1);
    expect(isoWeekday(sunday)).toBe(7);
  });

  it('rotation : la prochaine séance est la suivante du cycle, quel que soit le jour', async () => {
    const database = await setup();
    const { program, a, b } = await programABC(database);
    const plan = async (date: Date) =>
      plannedWorkoutFor(
        await getProgram(program.id, database),
        await listWorkouts(program.id, database),
        date,
      );

    expect(await plan(monday)).toMatchObject({ kind: 'workout', workout: { id: a.id } });
    expect(await plan(sunday)).toMatchObject({ kind: 'workout', workout: { id: a.id } });
    await setNextWorkout(program.id, b.id, database);
    expect(await plan(monday)).toMatchObject({ kind: 'workout', workout: { id: b.id } });
    database.close();
  });

  it('rotation : la prochaine séance reste la même quand on réordonne ou supprime', async () => {
    const database = await setup();
    const { program, a, b, c } = await programABC(database);
    const next = async () => {
      const p = (await getProgram(program.id, database))!;
      return p.rotation[p.nextRotationIndex];
    };
    await setNextWorkout(program.id, b.id, database);

    await reorderWorkouts(program.id, [c.id, b.id, a.id], database);
    expect(await next()).toBe(b.id);
    await deleteWorkout(c.id, database);
    expect(await next()).toBe(b.id);
    // La prochaine séance est supprimée : c'est celle qui la suivait.
    await deleteWorkout(b.id, database);
    expect(await next()).toBe(a.id);
    await deleteWorkout(a.id, database);
    expect((await getProgram(program.id, database))?.nextRotationIndex).toBe(0);
    database.close();
  });

  it('jours fixes : la séance du jour, sinon repos', async () => {
    const database = await setup();
    const { program, a, b } = await programABC(database);
    await setScheduleMode(program.id, 'fixedDays', database);
    await setFixedDay(program.id, 1, a.id, database);
    await setFixedDay(program.id, 7, b.id, database);
    const plan = async (date: Date) =>
      plannedWorkoutFor(
        await getProgram(program.id, database),
        await listWorkouts(program.id, database),
        date,
      );

    expect(await plan(monday)).toMatchObject({ kind: 'workout', workout: { id: a.id } });
    expect(await plan(sunday)).toMatchObject({ kind: 'workout', workout: { id: b.id } });
    expect(await plan(new Date(2026, 10, 17))).toEqual({ kind: 'rest' });

    // Retirer un jour, puis supprimer une séance : ses jours sont libérés.
    await setFixedDay(program.id, 1, null, database);
    expect(await plan(monday)).toEqual({ kind: 'rest' });
    await deleteWorkout(b.id, database);
    expect((await getProgram(program.id, database))?.fixedDays).toEqual({});
    database.close();
  });

  it('refuse une séance d’un autre programme', async () => {
    const database = await setup();
    const { program } = await programABC(database);
    const other = await createProgram('Autre', database);
    const foreign = await addWorkout(other.id, 'X', database);
    await expect(setFixedDay(program.id, 2, foreign.id, database)).rejects.toThrow(AppError);
    await expect(setNextWorkout(program.id, foreign.id, database)).rejects.toThrow(AppError);
    database.close();
  });

  it('sans programme ou sans séance, rien n’est prévu', async () => {
    const database = await setup();
    expect(plannedWorkoutFor(undefined, [], monday)).toEqual({ kind: 'none' });
    const program = await createProgram('Vide', database);
    expect(plannedWorkoutFor(program, [], monday)).toEqual({ kind: 'none' });
    database.close();
  });
});

describe('exercices prévus', () => {
  it('ajout avec des valeurs de départ, repos pris dans les réglages', async () => {
    const database = await setup();
    const { a } = await programABC(database);
    await setSetting('defaultRestSec', 90, database);
    const item = await addPlannedExercise(a.id, BENCH, database);
    expect(item).toMatchObject({
      exerciseId: BENCH,
      sets: 3,
      repMin: 8,
      repMax: 12,
      targetWeight: null,
      restSec: 90,
      note: '',
      supersetGroup: null,
    });
    expect((await getWorkout(a.id, database))?.items).toEqual([item]);
    await expect(addPlannedExercise(a.id, 'inconnu', database)).rejects.toThrow(AppError);
    database.close();
  });

  it('modification : les valeurs restent dans les bornes et la fourchette reste cohérente', async () => {
    const database = await setup();
    const { a } = await programABC(database);
    const { id } = await addPlannedExercise(a.id, BENCH, database);
    const item = async () => (await getWorkout(a.id, database))!.items[0];
    const update = (patch: Parameters<typeof updatePlannedExercise>[2]) =>
      updatePlannedExercise(a.id, id, patch, database);

    await update({ sets: 5, targetWeight: 82.5, restSec: 150, note: 'siège cran 4' });
    expect(await item()).toMatchObject({ sets: 5, targetWeight: 82.5, restSec: 150, note: 'siège cran 4' });

    await update({ sets: 0 });
    expect((await item()).sets).toBe(1);
    await update({ sets: 99 });
    expect((await item()).sets).toBe(20);

    // Monter le minimum au-dessus du maximum pousse le maximum, et inversement.
    await update({ repMin: 15 });
    expect(await item()).toMatchObject({ repMin: 15, repMax: 15 });
    await update({ repMax: 6 });
    expect(await item()).toMatchObject({ repMin: 6, repMax: 6 });

    await update({ targetWeight: 61.256 });
    expect((await item()).targetWeight).toBe(61.26);
    await update({ targetWeight: -5 });
    expect((await item()).targetWeight).toBe(0);
    await update({ targetWeight: null });
    expect((await item()).targetWeight).toBeNull();
    await update({ restSec: 5000 });
    expect((await item()).restSec).toBe(900);

    await expect(update({ targetWeight: Number.NaN })).rejects.toThrow(AppError);
    await expect(update({ sets: Number.NaN })).rejects.toThrow(AppError);
    expect((await item()).sets).toBe(20);
    database.close();
  });

  it('remplacer garde séries, répétitions et repos, mais efface charge et note', async () => {
    const database = await setup();
    const { a } = await programABC(database);
    const { id } = await addPlannedExercise(a.id, BENCH, database);
    await updatePlannedExercise(a.id, id, { sets: 4, restSec: 180, targetWeight: 80, note: 'banc 2' }, database);
    await replacePlannedExercise(a.id, id, ROW, database);
    expect((await getWorkout(a.id, database))?.items[0]).toMatchObject({
      id,
      exerciseId: ROW,
      sets: 4,
      restSec: 180,
      targetWeight: null,
      note: '',
    });
    database.close();
  });

  it('supprimer et réordonner', async () => {
    const database = await setup();
    const { a } = await programABC(database);
    const one = await addPlannedExercise(a.id, BENCH, database);
    const two = await addPlannedExercise(a.id, ROW, database);
    const three = await addPlannedExercise(a.id, CURL, database);
    const order = async () => (await getWorkout(a.id, database))!.items.map((i) => i.exerciseId);

    await reorderPlannedExercises(a.id, [three.id, one.id, two.id], database);
    expect(await order()).toEqual([CURL, BENCH, ROW]);
    await removePlannedExercise(a.id, one.id, database);
    expect(await order()).toEqual([CURL, ROW]);
    await expect(reorderPlannedExercises(a.id, [one.id], database)).rejects.toThrow(AppError);
    await expect(removePlannedExercise(a.id, one.id, database)).rejects.toThrow(AppError);
    database.close();
  });
});

describe('supersets', () => {
  async function fourItems(database: AppDB) {
    const { a } = await programABC(database);
    const ids: string[] = [];
    for (const exercise of [BENCH, ROW, CURL, SQUAT]) {
      ids.push((await addPlannedExercise(a.id, exercise, database)).id);
    }
    const links = async () => {
      const items = (await getWorkout(a.id, database))!.items;
      return items.map((_, index) => isLinkedWithNext(items, index));
    };
    const groups = async () => (await getWorkout(a.id, database))!.items.map((i) => i.supersetGroup);
    return { workoutId: a.id, ids, links, groups };
  }

  it('lier deux exercices voisins, puis un troisième', async () => {
    const database = await setup();
    const { workoutId, ids, links } = await fourItems(database);
    await setSupersetWithNext(workoutId, ids[0], true, database);
    expect(await links()).toEqual([true, false, false, false]);
    await setSupersetWithNext(workoutId, ids[1], true, database);
    expect(await links()).toEqual([true, true, false, false]);
    database.close();
  });

  it('lier deux supersets voisins les fusionne', async () => {
    const database = await setup();
    const { workoutId, ids, links, groups } = await fourItems(database);
    await setSupersetWithNext(workoutId, ids[0], true, database);
    await setSupersetWithNext(workoutId, ids[2], true, database);
    expect(await links()).toEqual([true, false, true, false]);
    await setSupersetWithNext(workoutId, ids[1], true, database);
    expect(await links()).toEqual([true, true, true, false]);
    expect(new Set(await groups()).size).toBe(1);
    database.close();
  });

  it('délier coupe le superset à cet endroit', async () => {
    const database = await setup();
    const { workoutId, ids, links, groups } = await fourItems(database);
    for (const id of ids.slice(0, 3)) await setSupersetWithNext(workoutId, id, true, database);
    await setSupersetWithNext(workoutId, ids[1], false, database);
    expect(await links()).toEqual([true, false, true, false]);
    // Délier un superset de deux le fait disparaître.
    await setSupersetWithNext(workoutId, ids[0], false, database);
    expect(await links()).toEqual([false, false, true, false]);
    expect((await groups()).slice(0, 2)).toEqual([null, null]);
    database.close();
  });

  it('supprimer ou déplacer un exercice ne laisse pas de superset d’un seul exercice', async () => {
    const database = await setup();
    const { workoutId, ids, links, groups } = await fourItems(database);
    await setSupersetWithNext(workoutId, ids[0], true, database);
    await removePlannedExercise(workoutId, ids[1], database);
    expect(await groups()).toEqual([null, null, null]);

    await setSupersetWithNext(workoutId, ids[0], true, database);
    expect(await links()).toEqual([true, false, false]);
    // On glisse le dernier exercice entre les deux liés : le superset est rompu.
    await reorderPlannedExercises(workoutId, [ids[0], ids[3], ids[2]], database);
    expect(await groups()).toEqual([null, null, null]);
    await expect(setSupersetWithNext(workoutId, ids[2], true, database)).rejects.toThrow(AppError);
    database.close();
  });

  it('un groupe coupé en deux morceaux donne deux supersets distincts', () => {
    const item = (id: string, supersetGroup: string | null): PlannedExercise => ({
      id,
      exerciseId: BENCH,
      sets: 3,
      repMin: 8,
      repMax: 12,
      targetWeight: null,
      restSec: 120,
      note: '',
      supersetGroup,
    });
    const out = normalizeSupersets([
      item('1', 'g'),
      item('2', 'g'),
      item('3', null),
      item('4', 'g'),
      item('5', 'g'),
      item('6', 'g'),
      item('7', 'h'),
    ]);
    const groups = out.map((i) => i.supersetGroup);
    expect(groups[0]).toBe('g');
    expect(groups[1]).toBe('g');
    expect(groups[2]).toBeNull();
    expect(groups[3]).not.toBe('g');
    expect(groups[3]).not.toBeNull();
    expect(groups[4]).toBe(groups[3]);
    expect(groups[5]).toBe(groups[3]);
    expect(groups[6]).toBeNull();
  });
});

describe('règle essentielle : modifier le programme ne modifie jamais l’historique', () => {
  it('aucune action sur le programme ne touche aux séances réalisées', async () => {
    const database = await freshDb();
    await fillSampleData(database);
    const history = async () => {
      const dump = await dumpOf(database);
      return {
        sessions: dump.sessions,
        sessionExercises: dump.sessionExercises,
        sets: dump.sets,
        bodyweights: dump.bodyweights,
      };
    };
    const before = await history();

    // On malmène le programme dont la séance « ses-1 » est issue.
    const [first] = (await getWorkout('wk-a', database))!.items;
    await renameProgram('prog-1', 'Tout autre nom', database);
    await renameWorkout('wk-a', 'Renommée', database);
    await updatePlannedExercise('wk-a', first.id, { sets: 10, targetWeight: 5, note: 'changé' }, database);
    await replacePlannedExercise('wk-a', first.id, SQUAT, database);
    await removePlannedExercise('wk-a', first.id, database);
    await addPlannedExercise('wk-a', CURL, database);
    await reorderWorkouts('prog-1', ['wk-b', 'wk-a'], database);
    await setScheduleMode('prog-1', 'fixedDays', database);
    await setFixedDay('prog-1', 3, 'wk-b', database);
    await duplicateProgram('prog-1', database);
    await duplicateWorkout('wk-a', database);
    await deleteWorkout('wk-a', database);
    await archiveProgram('prog-1', database);
    await deleteProgram('prog-1', database);

    expect(await getProgram('prog-1', database)).toBeUndefined();
    expect(await history()).toEqual(before);
    // La séance réalisée affiche toujours ce qui a été fait ce jour-là.
    expect(await database.sessions.get('ses-1')).toMatchObject({
      programName: 'Upper / Lower',
      workoutName: 'Upper A',
    });
    expect((await database.sessionExercises.get('se-1'))?.planned).toMatchObject({
      sets: 3,
      targetWeight: 80,
      note: 'banc n° 2',
    });
    database.close();
  });
});
