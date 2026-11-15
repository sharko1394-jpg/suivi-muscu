import { db, type AppDB } from './db';
import { getSettings } from './settings';
import type {
  ID,
  PlannedExercise,
  Program,
  ProgramWorkout,
  ScheduleMode,
  Weekday,
} from './types';
import { AppError, newId } from './util';

// RÈGLE : ce fichier n'écrit que dans les tiroirs `programs` et `programWorkouts`.
// Il ne touche jamais aux séances réalisées : modifier le programme ne modifie pas l'historique.

const NAME_MAX = 60;

/** Bornes des valeurs d'un exercice prévu. */
export const PLANNED_LIMITS = {
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  restSec: { min: 0, max: 900, step: 15 },
  weight: { min: 0, max: 1000 },
  noteLength: 200,
} as const;

const DEFAULT_PLANNED = { sets: 3, repMin: 8, repMax: 12 };

export type PlannedPatch = Partial<
  Pick<PlannedExercise, 'sets' | 'repMin' | 'repMax' | 'targetWeight' | 'restSec' | 'note'>
>;

export interface ProgramSummary extends Program {
  workoutCount: number;
}

// ---------- Outils internes ----------

function cleanName(name: string, kind: 'program' | 'workout'): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (clean.length === 0) {
    throw new AppError(kind === 'program' ? 'Donne un nom au programme.' : 'Donne un nom à la séance.');
  }
  if (clean.length > NAME_MAX) {
    throw new AppError(`Le nom est trop long (${NAME_MAX} caractères maximum).`);
  }
  return clean;
}

function copyName(name: string): string {
  const suffix = ' (copie)';
  return name.slice(0, NAME_MAX - suffix.length) + suffix;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) throw new AppError('Cette valeur n’est pas un nombre.');
  return Math.min(max, Math.max(min, Math.round(value)));
}

function cleanWeight(value: number): number {
  if (!Number.isFinite(value)) throw new AppError('Cette charge n’est pas un nombre.');
  const { min, max } = PLANNED_LIMITS.weight;
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
}

const programTables = (database: AppDB) => [database.programs, database.programWorkouts];

async function requireProgram(id: ID, database: AppDB): Promise<Program> {
  const program = await database.programs.get(id);
  if (!program) throw new AppError('Ce programme n’existe plus.');
  return program;
}

async function requireWorkout(id: ID, database: AppDB): Promise<ProgramWorkout> {
  const workout = await database.programWorkouts.get(id);
  if (!workout) throw new AppError('Cette séance n’existe plus.');
  return workout;
}

function assertSameIds(given: ID[], existing: ID[]): void {
  const a = [...given].sort();
  const b = [...existing].sort();
  if (a.length !== b.length || a.some((id, i) => id !== b[i])) {
    throw new AppError('La liste a changé entre-temps. Réessaie.');
  }
}

/**
 * Remet en cohérence un programme après un changement dans ses séances :
 * numérotation, cycle de rotation, prochaine séance, jours fixes.
 */
async function syncSchedule(programId: ID, database: AppDB): Promise<void> {
  const program = await database.programs.get(programId);
  if (!program) return;
  const workouts = await listWorkouts(programId, database);
  const ids = workouts.map((w) => w.id);

  await Promise.all(
    workouts.map((w, index) =>
      w.order === index ? undefined : database.programWorkouts.update(w.id, { order: index }),
    ),
  );

  // La « prochaine séance » reste la même tant qu'elle existe ;
  // si elle a été supprimée, c'est celle qui la suivait.
  let nextRotationIndex = ids.indexOf(program.rotation[program.nextRotationIndex]);
  if (nextRotationIndex === -1) {
    nextRotationIndex = ids.length === 0 ? 0 : program.nextRotationIndex % ids.length;
  }

  const fixedDays: Program['fixedDays'] = {};
  for (const [day, workoutId] of Object.entries(program.fixedDays)) {
    if (workoutId && ids.includes(workoutId)) fixedDays[Number(day) as Weekday] = workoutId;
  }

  await database.programs.update(programId, {
    rotation: ids,
    nextRotationIndex,
    fixedDays,
    updatedAt: Date.now(),
  });
}

// ---------- Lecture ----------

const STATUS_ORDER: Record<Program['status'], number> = { active: 0, inactive: 1, archived: 2 };

export async function listPrograms(database: AppDB = db): Promise<ProgramSummary[]> {
  const [programs, workouts] = await Promise.all([
    database.programs.toArray(),
    database.programWorkouts.toArray(),
  ]);
  return programs
    .map((p) => ({ ...p, workoutCount: workouts.filter((w) => w.programId === p.id).length }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'fr'),
    );
}

export function getProgram(id: ID, database: AppDB = db): Promise<Program | undefined> {
  return database.programs.get(id);
}

export function getActiveProgram(database: AppDB = db): Promise<Program | undefined> {
  return database.programs.where('status').equals('active').first();
}

/** Séances d'un programme, dans leur ordre. */
export function listWorkouts(programId: ID, database: AppDB = db): Promise<ProgramWorkout[]> {
  return database.programWorkouts.where('programId').equals(programId).sortBy('order');
}

export function getWorkout(id: ID, database: AppDB = db): Promise<ProgramWorkout | undefined> {
  return database.programWorkouts.get(id);
}

// ---------- Programmes ----------

/** Le tout premier programme devient actif ; les suivants attendent d'être choisis. */
export async function createProgram(name: string, database: AppDB = db): Promise<Program> {
  const clean = cleanName(name, 'program');
  return database.transaction('rw', database.programs, async () => {
    const hasActive = (await database.programs.where('status').equals('active').count()) > 0;
    const t = Date.now();
    const program: Program = {
      id: newId(),
      name: clean,
      status: hasActive ? 'inactive' : 'active',
      scheduleMode: 'rotation',
      fixedDays: {},
      rotation: [],
      nextRotationIndex: 0,
      createdAt: t,
      updatedAt: t,
    };
    await database.programs.add(program);
    return program;
  });
}

export async function renameProgram(id: ID, name: string, database: AppDB = db): Promise<void> {
  const clean = cleanName(name, 'program');
  await database.transaction('rw', database.programs, async () => {
    await requireProgram(id, database);
    await database.programs.update(id, { name: clean, updatedAt: Date.now() });
  });
}

/** Rend ce programme actif. Un seul programme est actif à la fois. */
export async function setActiveProgram(id: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.programs, async () => {
    await requireProgram(id, database);
    const t = Date.now();
    await database.programs
      .where('status')
      .equals('active')
      .modify({ status: 'inactive', updatedAt: t });
    await database.programs.update(id, { status: 'active', updatedAt: t });
  });
}

export async function archiveProgram(id: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.programs, async () => {
    await requireProgram(id, database);
    await database.programs.update(id, { status: 'archived', updatedAt: Date.now() });
  });
}

export async function unarchiveProgram(id: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.programs, async () => {
    const program = await requireProgram(id, database);
    if (program.status !== 'archived') return;
    await database.programs.update(id, { status: 'inactive', updatedAt: Date.now() });
  });
}

function copyItems(items: PlannedExercise[]): PlannedExercise[] {
  const groups = new Map<string, string>();
  return items.map((item) => {
    let supersetGroup: string | null = null;
    if (item.supersetGroup !== null) {
      supersetGroup = groups.get(item.supersetGroup) ?? newId();
      groups.set(item.supersetGroup, supersetGroup);
    }
    return { ...item, id: newId(), supersetGroup };
  });
}

/** Copie complète et indépendante d'un programme, séances comprises. */
export async function duplicateProgram(id: ID, database: AppDB = db): Promise<Program> {
  return database.transaction('rw', programTables(database), async () => {
    const source = await requireProgram(id, database);
    const workouts = await listWorkouts(id, database);
    const t = Date.now();
    const copyId = newId();
    const newIds = new Map<ID, ID>(workouts.map((w) => [w.id, newId()]));

    const fixedDays: Program['fixedDays'] = {};
    for (const [day, workoutId] of Object.entries(source.fixedDays)) {
      const mapped = workoutId && newIds.get(workoutId);
      if (mapped) fixedDays[Number(day) as Weekday] = mapped;
    }

    const copy: Program = {
      ...source,
      id: copyId,
      name: copyName(source.name),
      status: 'inactive',
      fixedDays,
      rotation: workouts.map((w) => newIds.get(w.id)!),
      nextRotationIndex: 0,
      createdAt: t,
      updatedAt: t,
    };
    await database.programs.add(copy);
    await database.programWorkouts.bulkAdd(
      workouts.map((w) => ({
        ...w,
        id: newIds.get(w.id)!,
        programId: copyId,
        items: copyItems(w.items),
        createdAt: t,
        updatedAt: t,
      })),
    );
    return copy;
  });
}

/**
 * Supprime définitivement un programme archivé et ses séances.
 * L'historique n'est pas touché : chaque séance réalisée a sa propre copie.
 */
export async function deleteProgram(id: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', programTables(database), async () => {
    const program = await requireProgram(id, database);
    if (program.status !== 'archived') {
      throw new AppError('Archive d’abord ce programme avant de le supprimer.');
    }
    await database.programWorkouts.where('programId').equals(id).delete();
    await database.programs.delete(id);
  });
}

// ---------- Planification ----------

export async function setScheduleMode(
  id: ID,
  scheduleMode: ScheduleMode,
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.programs, async () => {
    await requireProgram(id, database);
    await database.programs.update(id, { scheduleMode, updatedAt: Date.now() });
  });
}

/** Mode jours fixes : associe une séance à un jour, ou null pour un jour de repos. */
export async function setFixedDay(
  programId: ID,
  weekday: Weekday,
  workoutId: ID | null,
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', programTables(database), async () => {
    const program = await requireProgram(programId, database);
    const fixedDays = { ...program.fixedDays };
    if (workoutId === null) {
      delete fixedDays[weekday];
    } else {
      const workout = await requireWorkout(workoutId, database);
      if (workout.programId !== programId) throw new AppError('Cette séance n’est pas dans ce programme.');
      fixedDays[weekday] = workoutId;
    }
    await database.programs.update(programId, { fixedDays, updatedAt: Date.now() });
  });
}

/** Mode rotation : choisit la séance par laquelle le cycle reprend. */
export async function setNextWorkout(
  programId: ID,
  workoutId: ID,
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.programs, async () => {
    const program = await requireProgram(programId, database);
    const index = program.rotation.indexOf(workoutId);
    if (index === -1) throw new AppError('Cette séance n’est pas dans ce programme.');
    await database.programs.update(programId, { nextRotationIndex: index, updatedAt: Date.now() });
  });
}

// ---------- Séances du programme ----------

export async function addWorkout(
  programId: ID,
  name: string,
  database: AppDB = db,
): Promise<ProgramWorkout> {
  const clean = cleanName(name, 'workout');
  return database.transaction('rw', programTables(database), async () => {
    await requireProgram(programId, database);
    const t = Date.now();
    const workout: ProgramWorkout = {
      id: newId(),
      programId,
      name: clean,
      order: await database.programWorkouts.where('programId').equals(programId).count(),
      items: [],
      createdAt: t,
      updatedAt: t,
    };
    await database.programWorkouts.add(workout);
    await syncSchedule(programId, database);
    return workout;
  });
}

export async function renameWorkout(id: ID, name: string, database: AppDB = db): Promise<void> {
  const clean = cleanName(name, 'workout');
  await database.transaction('rw', database.programWorkouts, async () => {
    await requireWorkout(id, database);
    await database.programWorkouts.update(id, { name: clean, updatedAt: Date.now() });
  });
}

/** Copie une séance dans le même programme, juste après l'originale. */
export async function duplicateWorkout(id: ID, database: AppDB = db): Promise<ProgramWorkout> {
  return database.transaction('rw', programTables(database), async () => {
    const source = await requireWorkout(id, database);
    const t = Date.now();
    const copy: ProgramWorkout = {
      ...source,
      id: newId(),
      name: copyName(source.name),
      order: source.order + 0.5,
      items: copyItems(source.items),
      createdAt: t,
      updatedAt: t,
    };
    await database.programWorkouts.add(copy);
    await syncSchedule(source.programId, database);
    return (await database.programWorkouts.get(copy.id))!;
  });
}

export async function deleteWorkout(id: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', programTables(database), async () => {
    const workout = await requireWorkout(id, database);
    await database.programWorkouts.delete(id);
    await syncSchedule(workout.programId, database);
  });
}

export async function reorderWorkouts(
  programId: ID,
  orderedIds: ID[],
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', programTables(database), async () => {
    const workouts = await listWorkouts(programId, database);
    assertSameIds(
      orderedIds,
      workouts.map((w) => w.id),
    );
    await Promise.all(
      orderedIds.map((id, index) => database.programWorkouts.update(id, { order: index })),
    );
    await syncSchedule(programId, database);
  });
}

// ---------- Exercices prévus dans une séance ----------

/**
 * Remet les supersets d'aplomb : un superset est une suite d'exercices voisins.
 * Un exercice resté seul dans son groupe (après un déplacement, une suppression…) en sort.
 */
export function normalizeSupersets(items: PlannedExercise[]): PlannedExercise[] {
  const out = items.map((item) => ({ ...item }));
  const seen = new Set<string>();
  let start = 0;
  while (start < out.length) {
    const group = out[start].supersetGroup;
    let end = start + 1;
    if (group !== null) {
      while (end < out.length && out[end].supersetGroup === group) end++;
      if (end - start < 2) {
        out[start].supersetGroup = null;
      } else if (seen.has(group)) {
        // Le groupe a été coupé en deux par un déplacement : ce morceau devient un superset à part.
        const fresh = newId();
        for (let i = start; i < end; i++) out[i].supersetGroup = fresh;
        seen.add(fresh);
      } else {
        seen.add(group);
      }
    }
    start = end;
  }
  return out;
}

/** Vrai si l'exercice à cette position est en superset avec le suivant. */
export function isLinkedWithNext(items: PlannedExercise[], index: number): boolean {
  const group = items[index]?.supersetGroup ?? null;
  return group !== null && items[index + 1]?.supersetGroup === group;
}

async function changeItems(
  workoutId: ID,
  database: AppDB,
  change: (items: PlannedExercise[]) => PlannedExercise[],
): Promise<void> {
  const workout = await requireWorkout(workoutId, database);
  const items = normalizeSupersets(change(workout.items.map((item) => ({ ...item }))));
  await database.programWorkouts.update(workoutId, { items, updatedAt: Date.now() });
}

function indexOfItem(items: PlannedExercise[], itemId: ID): number {
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) throw new AppError('Cet exercice n’est plus dans la séance.');
  return index;
}

/** Ajoute un exercice en fin de séance, avec des valeurs de départ modifiables ensuite. */
export async function addPlannedExercise(
  workoutId: ID,
  exerciseId: ID,
  database: AppDB = db,
): Promise<PlannedExercise> {
  return database.transaction(
    'rw',
    [database.programWorkouts, database.exercises, database.settings],
    async () => {
      if (!(await database.exercises.get(exerciseId))) {
        throw new AppError('Cet exercice n’existe plus.');
      }
      const { defaultRestSec } = await getSettings(database);
      const item: PlannedExercise = {
        id: newId(),
        exerciseId,
        ...DEFAULT_PLANNED,
        targetWeight: null,
        restSec: defaultRestSec,
        note: '',
        supersetGroup: null,
      };
      await changeItems(workoutId, database, (items) => [...items, item]);
      return item;
    },
  );
}

/** Modifie un exercice prévu. Les valeurs hors bornes sont ramenées dans les bornes. */
export async function updatePlannedExercise(
  workoutId: ID,
  itemId: ID,
  patch: PlannedPatch,
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.programWorkouts, () =>
    changeItems(workoutId, database, (items) => {
      const item = items[indexOfItem(items, itemId)];
      const { sets, reps, restSec, noteLength } = PLANNED_LIMITS;
      if (patch.sets !== undefined) item.sets = clampInt(patch.sets, sets.min, sets.max);
      if (patch.repMin !== undefined) {
        item.repMin = clampInt(patch.repMin, reps.min, reps.max);
        if (item.repMax < item.repMin) item.repMax = item.repMin;
      }
      if (patch.repMax !== undefined) {
        item.repMax = clampInt(patch.repMax, reps.min, reps.max);
        if (item.repMin > item.repMax) item.repMin = item.repMax;
      }
      if (patch.restSec !== undefined) {
        item.restSec = clampInt(patch.restSec, restSec.min, restSec.max);
      }
      if (patch.targetWeight !== undefined) {
        item.targetWeight = patch.targetWeight === null ? null : cleanWeight(patch.targetWeight);
      }
      if (patch.note !== undefined) item.note = patch.note.slice(0, noteLength);
      return items;
    }),
  );
}

export async function removePlannedExercise(
  workoutId: ID,
  itemId: ID,
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.programWorkouts, () =>
    changeItems(workoutId, database, (items) => {
      items.splice(indexOfItem(items, itemId), 1);
      return items;
    }),
  );
}

/**
 * Remplace l'exercice en gardant séries, répétitions et repos.
 * La charge cible et la note sont propres à l'ancien exercice : elles sont effacées.
 */
export async function replacePlannedExercise(
  workoutId: ID,
  itemId: ID,
  exerciseId: ID,
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', [database.programWorkouts, database.exercises], async () => {
    if (!(await database.exercises.get(exerciseId))) {
      throw new AppError('Cet exercice n’existe plus.');
    }
    await changeItems(workoutId, database, (items) => {
      const item = items[indexOfItem(items, itemId)];
      if (item.exerciseId !== exerciseId) {
        item.exerciseId = exerciseId;
        item.targetWeight = null;
        item.note = '';
      }
      return items;
    });
  });
}

export async function reorderPlannedExercises(
  workoutId: ID,
  orderedItemIds: ID[],
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.programWorkouts, () =>
    changeItems(workoutId, database, (items) => {
      assertSameIds(
        orderedItemIds,
        items.map((item) => item.id),
      );
      return orderedItemIds.map((id) => items.find((item) => item.id === id)!);
    }),
  );
}

/** Lie (ou délie) un exercice avec le suivant pour former un superset. */
export async function setSupersetWithNext(
  workoutId: ID,
  itemId: ID,
  linked: boolean,
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.programWorkouts, () =>
    changeItems(workoutId, database, (items) => {
      const index = indexOfItem(items, itemId);
      const current = items[index];
      const next = items[index + 1];
      if (!next) throw new AppError('Il n’y a pas d’exercice suivant à lier.');

      if (linked) {
        const group = current.supersetGroup ?? next.supersetGroup ?? newId();
        const absorbed = next.supersetGroup;
        for (const item of items) {
          if (absorbed !== null && item.supersetGroup === absorbed) item.supersetGroup = group;
        }
        current.supersetGroup = group;
        next.supersetGroup = group;
      } else if (current.supersetGroup !== null && next.supersetGroup === current.supersetGroup) {
        // On coupe ici : la suite du groupe part dans un nouveau groupe.
        const group = current.supersetGroup;
        const fresh = newId();
        for (let i = index + 1; i < items.length && items[i].supersetGroup === group; i++) {
          items[i].supersetGroup = fresh;
        }
      }
      return items;
    }),
  );
}

// ---------- Quelle séance aujourd'hui ? ----------

export type TodayPlan =
  | { kind: 'none' }
  | { kind: 'rest' }
  | { kind: 'workout'; workout: ProgramWorkout };

/** Jour de la semaine au format ISO : 1 = lundi … 7 = dimanche. */
export function isoWeekday(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

/**
 * Séance prévue à une date donnée.
 * Jours fixes : celle du jour, sinon repos. Rotation : la suivante du cycle, quel que soit le jour.
 */
export function plannedWorkoutFor(
  program: Program | undefined,
  workouts: ProgramWorkout[],
  date: Date,
): TodayPlan {
  if (!program || workouts.length === 0) return { kind: 'none' };
  if (program.scheduleMode === 'fixedDays') {
    const workout = workouts.find((w) => w.id === program.fixedDays[isoWeekday(date)]);
    return workout ? { kind: 'workout', workout } : { kind: 'rest' };
  }
  const nextId = program.rotation[program.nextRotationIndex];
  return { kind: 'workout', workout: workouts.find((w) => w.id === nextId) ?? workouts[0] };
}
