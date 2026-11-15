import { isCountedSet, totalVolume, annotateRecords, type Lift, type RecordKind } from './calc';
import { db, type AppDB } from './db';
import { getActiveProgram, listWorkouts, plannedWorkoutFor, replacePlannedExercise, type TodayPlan } from './programs';
import { nextSetId, restAfter, type FlowExercise } from './sessionFlow';
import { getSettings, setSetting } from './settings';
import type {
  Exercise,
  ID,
  PlannedExercise,
  PlannedSnapshot,
  Program,
  ProgramWorkout,
  Session,
  SessionExercise,
  SetEntry,
  SetType,
} from './types';
import { AppError, localDate, newId } from './util';

// Séances réalisées. Une séance copie au démarrage tout ce dont elle a besoin
// (noms, muscles, ce qui était prévu) : elle ne dépend plus du programme ensuite.

export const SET_LIMITS = {
  weight: { min: 0, max: 1000 },
  reps: { min: 1, max: 100 },
  rpe: { min: 1, max: 10 },
} as const;

/** Valeurs de RPE proposées pendant la séance. */
export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

const DEFAULT_SET_COUNT = 3;
const DEFAULT_REPS = 10;
const FREE_SESSION_NAME = 'Séance libre';
/**
 * Séance oubliée ouverte : si on la termine plus de 45 minutes après la dernière série validée,
 * sa fin est ramenée à cette dernière série (sinon elle durerait des heures, voire des jours).
 */
const IDLE_END_MS = 45 * 60 * 1000;

const sessionTables = (database: AppDB) => [
  database.sessions,
  database.sessionExercises,
  database.sets,
  database.programs,
  database.programWorkouts,
  database.exercises,
  database.settings,
];

// ---------- Lecture ----------

export interface SessionExerciseDetail {
  exercise: SessionExercise;
  sets: SetEntry[];
}

export interface SessionDetail {
  session: Session;
  exercises: SessionExerciseDetail[];
}

export function getActiveSession(database: AppDB = db): Promise<Session | undefined> {
  return database.sessions.where('status').equals('inProgress').first();
}

export async function getSessionDetail(
  sessionId: ID,
  database: AppDB = db,
): Promise<SessionDetail | undefined> {
  const session = await database.sessions.get(sessionId);
  if (!session) return undefined;
  const [exercises, sets] = await Promise.all([
    database.sessionExercises.where('sessionId').equals(sessionId).sortBy('order'),
    database.sets.where('sessionId').equals(sessionId).toArray(),
  ]);
  return {
    session,
    exercises: exercises.map((exercise) => ({
      exercise,
      sets: sets.filter((s) => s.sessionExerciseId === exercise.id).sort((a, b) => a.order - b.order),
    })),
  };
}

/** Ce qu'on sait d'un exercice d'après les séances terminées. */
export interface ExerciseHistory {
  /** Séries qui comptent de la séance la plus récente, dans l'ordre. */
  last: { date: string; sets: SetEntry[] } | null;
  /** Toutes les séries qui comptent, pour les records. */
  lifts: Lift[];
}

/**
 * Historique de plusieurs exercices, tiré des séances terminées.
 * `before` limite aux séances commencées avant cette date (pour juger une séance passée).
 */
export async function getExercisesHistory(
  exerciseIds: ID[],
  options: { excludeSessionId?: ID; before?: number } = {},
  database: AppDB = db,
): Promise<Map<ID, ExerciseHistory>> {
  const result = new Map<ID, ExerciseHistory>();
  const ids = [...new Set(exerciseIds)];
  if (ids.length === 0) return result;

  const sets = (await database.sets.where('exerciseId').anyOf(ids).toArray()).filter(isCountedSet);
  const sessions = await database.sessions.bulkGet([...new Set(sets.map((s) => s.sessionId))]);
  const usable = new Map<ID, Session>();
  for (const session of sessions) {
    if (
      session &&
      session.status === 'done' &&
      session.id !== options.excludeSessionId &&
      (options.before === undefined || session.startedAt < options.before)
    ) {
      usable.set(session.id, session);
    }
  }

  for (const exerciseId of ids) {
    const mine = sets.filter((s) => s.exerciseId === exerciseId && usable.has(s.sessionId));
    let latest: Session | null = null;
    for (const set of mine) {
      const session = usable.get(set.sessionId)!;
      if (latest === null || session.startedAt > latest.startedAt) latest = session;
    }
    const lastSession: Session | null = latest;
    result.set(exerciseId, {
      last: lastSession
        ? {
            date: lastSession.date,
            sets: mine
              .filter((s) => s.sessionId === lastSession.id)
              .sort((a, b) => a.order - b.order),
          }
        : null,
      lifts: mine.map((s) => ({ weight: s.weight, reps: s.reps })),
    });
  }
  return result;
}

// ---------- Préremplissage ----------

/**
 * Valeurs de départ des séries d'un exercice.
 * D'abord la dernière performance (série par série) ; sinon ce que prévoit le programme.
 */
export function prefillSets(input: {
  count: number;
  last: Lift[];
  planned: Pick<PlannedSnapshot, 'repMin' | 'targetWeight'> | null;
  bodyweight: boolean;
}): { weight: number | null; reps: number }[] {
  const { count, last, planned, bodyweight } = input;
  return Array.from({ length: count }, (_, index) => {
    const previous = last.length > 0 ? last[Math.min(index, last.length - 1)] : null;
    return {
      weight: previous?.weight ?? planned?.targetWeight ?? (bodyweight ? 0 : null),
      reps: previous?.reps ?? planned?.repMin ?? DEFAULT_REPS,
    };
  });
}

function snapshotOf(item: PlannedExercise): PlannedSnapshot {
  return {
    sets: item.sets,
    repMin: item.repMin,
    repMax: item.repMax,
    targetWeight: item.targetWeight,
    restSec: item.restSec,
    note: item.note,
  };
}

async function insertExercise(
  database: AppDB,
  input: {
    sessionId: ID;
    order: number;
    exercise: Exercise;
    planned: PlannedSnapshot | null;
    supersetGroup: string | null;
    setCount: number | null;
    history: ExerciseHistory | undefined;
  },
): Promise<SessionExercise> {
  const { exercise, planned, history } = input;
  const t = Date.now();
  const sessionExercise: SessionExercise = {
    id: newId(),
    sessionId: input.sessionId,
    order: input.order,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: [...exercise.secondaryMuscles],
    equipment: exercise.equipment,
    planned,
    supersetGroup: input.supersetGroup,
    note: '',
    createdAt: t,
    updatedAt: t,
  };
  const last = history?.last?.sets ?? [];
  const count =
    input.setCount ?? planned?.sets ?? (last.length > 0 ? Math.min(last.length, 6) : DEFAULT_SET_COUNT);
  const values = prefillSets({
    count,
    last: last.filter(isCountedSet),
    planned,
    bodyweight: exercise.equipment === 'poids-du-corps',
  });
  await database.sessionExercises.add(sessionExercise);
  await database.sets.bulkAdd(
    values.map((value, order): SetEntry => ({
      id: newId(),
      sessionId: input.sessionId,
      sessionExerciseId: sessionExercise.id,
      exerciseId: exercise.id,
      order,
      type: 'normal',
      weight: value.weight,
      reps: value.reps,
      rpe: null,
      done: false,
      completedAt: null,
      createdAt: t,
      updatedAt: t,
    })),
  );
  return sessionExercise;
}

// ---------- Démarrer, terminer, abandonner ----------

/** Démarre une séance du programme, ou une séance libre si `workoutId` est null. */
export async function startSession(workoutId: ID | null, database: AppDB = db): Promise<Session> {
  return database.transaction('rw', sessionTables(database), async () => {
    if (await getActiveSession(database)) {
      throw new AppError('Une séance est déjà en cours. Termine-la ou abandonne-la d’abord.');
    }
    let workout: ProgramWorkout | undefined;
    let program: Program | undefined;
    if (workoutId !== null) {
      workout = await database.programWorkouts.get(workoutId);
      if (!workout) throw new AppError('Cette séance n’existe plus dans le programme.');
      program = await database.programs.get(workout.programId);
    }

    const t = Date.now();
    const session: Session = {
      id: newId(),
      status: 'inProgress',
      startedAt: t,
      endedAt: null,
      date: localDate(t),
      programId: program?.id ?? null,
      programName: program?.name ?? null,
      workoutId: workout?.id ?? null,
      workoutName: workout?.name ?? FREE_SESSION_NAME,
      note: '',
      createdAt: t,
      updatedAt: t,
    };
    await database.sessions.add(session);

    const items = workout?.items ?? [];
    const history = await getExercisesHistory(
      items.map((item) => item.exerciseId),
      {},
      database,
    );
    let order = 0;
    for (const item of items) {
      const exercise = await database.exercises.get(item.exerciseId);
      if (!exercise) continue;
      await insertExercise(database, {
        sessionId: session.id,
        order: order++,
        exercise,
        planned: snapshotOf(item),
        supersetGroup: item.supersetGroup,
        setCount: null,
        history: history.get(exercise.id),
      });
    }
    await setSetting('restTimer', null, database);
    await setSetting('skippedDay', null, database);
    return session;
  });
}

async function requireInProgress(sessionId: ID, database: AppDB): Promise<Session> {
  const session = await database.sessions.get(sessionId);
  if (!session) throw new AppError('Cette séance n’existe plus.');
  if (session.status !== 'inProgress') throw new AppError('Cette séance est déjà terminée.');
  return session;
}

async function deleteSessionRows(sessionId: ID, database: AppDB): Promise<void> {
  await database.sets.where('sessionId').equals(sessionId).delete();
  await database.sessionExercises.where('sessionId').equals(sessionId).delete();
  await database.sessions.delete(sessionId);
}

/**
 * Termine la séance : ne garde que les séries validées.
 * Sans aucune série validée, il n'y a rien à enregistrer : la séance est écartée.
 */
export async function finishSession(
  sessionId: ID,
  now: number = Date.now(),
  database: AppDB = db,
): Promise<'saved' | 'discarded'> {
  return database.transaction('rw', sessionTables(database), async () => {
    const session = await requireInProgress(sessionId, database);
    const sets = await database.sets.where('sessionId').equals(sessionId).toArray();
    const done = sets.filter((s) => s.done);
    await setSetting('restTimer', null, database);

    if (done.length === 0) {
      await deleteSessionRows(sessionId, database);
      return 'discarded';
    }

    await database.sets.bulkDelete(sets.filter((s) => !s.done).map((s) => s.id));
    const exercises = await database.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
    let order = 0;
    for (const exercise of exercises) {
      const kept = done.filter((s) => s.sessionExerciseId === exercise.id).sort((a, b) => a.order - b.order);
      if (kept.length === 0) {
        await database.sessionExercises.delete(exercise.id);
        continue;
      }
      await database.sessionExercises.update(exercise.id, { order: order++ });
      await Promise.all(kept.map((s, index) => database.sets.update(s.id, { order: index })));
    }

    // Séance oubliée ouverte : elle s'arrête à la dernière série validée, pas des heures après.
    const lastDone = Math.max(...done.map((s) => s.completedAt ?? session.startedAt));
    const endedAt = now - lastDone > IDLE_END_MS ? lastDone : now;
    await database.sessions.update(sessionId, { status: 'done', endedAt, updatedAt: now });

    // Rotation : la prochaine séance est celle qui suit, dans le cycle, la séance qu'on vient de faire.
    if (session.programId && session.workoutId) {
      const program = await database.programs.get(session.programId);
      const index = program ? program.rotation.indexOf(session.workoutId) : -1;
      if (program && index !== -1) {
        await database.programs.update(program.id, {
          nextRotationIndex: (index + 1) % program.rotation.length,
          updatedAt: now,
        });
      }
    }
    return 'saved';
  });
}

/** Efface une séance en cours, avec tout ce qui y a été saisi. */
export async function abandonSession(sessionId: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', sessionTables(database), async () => {
    await requireInProgress(sessionId, database);
    await deleteSessionRows(sessionId, database);
    await setSetting('restTimer', null, database);
  });
}

// ---------- Exercices de la séance ----------

async function reindexExercises(sessionId: ID, database: AppDB): Promise<void> {
  const exercises = await database.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
  await Promise.all(
    exercises.map((e, index) =>
      e.order === index ? undefined : database.sessionExercises.update(e.id, { order: index }),
    ),
  );
}

async function requireSessionExercise(id: ID, database: AppDB): Promise<SessionExercise> {
  const exercise = await database.sessionExercises.get(id);
  if (!exercise) throw new AppError('Cet exercice n’est plus dans la séance.');
  return exercise;
}

/** Ajoute en fin de séance un exercice qui n'était pas prévu. */
export async function addSessionExercise(
  sessionId: ID,
  exerciseId: ID,
  database: AppDB = db,
): Promise<SessionExercise> {
  return database.transaction('rw', sessionTables(database), async () => {
    await requireInProgress(sessionId, database);
    const exercise = await database.exercises.get(exerciseId);
    if (!exercise) throw new AppError('Cet exercice n’existe plus.');
    const history = await getExercisesHistory([exerciseId], { excludeSessionId: sessionId }, database);
    return insertExercise(database, {
      sessionId,
      order: await database.sessionExercises.where('sessionId').equals(sessionId).count(),
      exercise,
      planned: null,
      supersetGroup: null,
      setCount: null,
      history: history.get(exerciseId),
    });
  });
}

export async function removeSessionExercise(id: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', sessionTables(database), async () => {
    const exercise = await requireSessionExercise(id, database);
    await requireInProgress(exercise.sessionId, database);
    await database.sets.where('sessionExerciseId').equals(id).delete();
    await database.sessionExercises.delete(id);
    await reindexExercises(exercise.sessionId, database);
  });
}

/**
 * Remplace un exercice pendant la séance.
 * Si des séries sont déjà validées, elles restent sur l'ancien exercice et le nouveau
 * prend la suite. Avec `alsoInProgram`, le programme est modifié lui aussi.
 */
export async function replaceSessionExercise(
  id: ID,
  newExerciseId: ID,
  alsoInProgram: boolean,
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', sessionTables(database), async () => {
    const target = await requireSessionExercise(id, database);
    const session = await requireInProgress(target.sessionId, database);
    if (target.exerciseId === newExerciseId) return;
    const exercise = await database.exercises.get(newExerciseId);
    if (!exercise) throw new AppError('Cet exercice n’existe plus.');

    if (alsoInProgram && session.workoutId) {
      const workout = await database.programWorkouts.get(session.workoutId);
      const item = workout?.items.find((i) => i.exerciseId === target.exerciseId);
      if (workout && item) await replacePlannedExercise(workout.id, item.id, newExerciseId, database);
    }

    const sets = await database.sets.where('sessionExerciseId').equals(id).toArray();
    const pending = sets.filter((s) => !s.done);
    const hasDone = pending.length < sets.length;
    // La charge cible et la note appartenaient à l'ancien exercice.
    const planned = target.planned ? { ...target.planned, targetWeight: null, note: '' } : null;
    const history = await getExercisesHistory([newExerciseId], { excludeSessionId: session.id }, database);

    await database.sets.bulkDelete(pending.map((s) => s.id));
    if (!hasDone) await database.sessionExercises.delete(id);
    await insertExercise(database, {
      sessionId: session.id,
      order: hasDone ? target.order + 0.5 : target.order,
      exercise,
      planned,
      supersetGroup: target.supersetGroup,
      setCount: Math.max(1, pending.length),
      history: history.get(newExerciseId),
    });
    await reindexExercises(session.id, database);
  });
}

export async function setSessionNote(sessionId: ID, note: string, database: AppDB = db): Promise<void> {
  await database.sessions.update(sessionId, { note: note.slice(0, 500), updatedAt: Date.now() });
}

export async function setSessionExerciseNote(id: ID, note: string, database: AppDB = db): Promise<void> {
  await database.sessionExercises.update(id, { note: note.slice(0, 300), updatedAt: Date.now() });
}

// ---------- Séries ----------

export interface SetPatch {
  weight?: number | null;
  reps?: number;
  rpe?: number | null;
  type?: SetType;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function cleanNumber(value: number, what: string): number {
  if (!Number.isFinite(value)) throw new AppError(`${what} : ce n’est pas un nombre.`);
  return value;
}

async function requireSet(id: ID, database: AppDB): Promise<SetEntry> {
  const set = await database.sets.get(id);
  if (!set) throw new AppError('Cette série n’existe plus.');
  return set;
}

/**
 * Modifie une série. Changer la charge d'une série pas encore faite change aussi les
 * suivantes qui avaient la même charge : inutile de la régler série par série.
 */
export async function updateSet(id: ID, patch: SetPatch, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.sets, async () => {
    const set = await requireSet(id, database);
    const t = Date.now();
    const changes: Partial<SetEntry> = { updatedAt: t };

    if (patch.weight !== undefined) {
      const { min, max } = SET_LIMITS.weight;
      changes.weight =
        patch.weight === null
          ? null
          : Math.round(clamp(cleanNumber(patch.weight, 'Charge'), min, max) * 100) / 100;
    }
    if (patch.reps !== undefined) {
      const { min, max } = SET_LIMITS.reps;
      changes.reps = clamp(Math.round(cleanNumber(patch.reps, 'Répétitions')), min, max);
    }
    if (patch.rpe !== undefined) {
      const { min, max } = SET_LIMITS.rpe;
      changes.rpe =
        patch.rpe === null ? null : Math.round(clamp(cleanNumber(patch.rpe, 'RPE'), min, max) * 2) / 2;
    }
    if (patch.type !== undefined) changes.type = patch.type;
    await database.sets.update(id, changes);

    const newWeight = changes.weight;
    if (newWeight !== undefined && newWeight !== set.weight && !set.done && set.type !== 'warmup') {
      const followers = await database.sets
        .where('sessionExerciseId')
        .equals(set.sessionExerciseId)
        .filter(
          (s) =>
            s.order > set.order &&
            !s.done &&
            s.type !== 'warmup' &&
            (s.weight === set.weight || s.weight === null),
        )
        .toArray();
      await Promise.all(
        followers.map((s) => database.sets.update(s.id, { weight: newWeight, updatedAt: t })),
      );
    }
  });
}

async function flowOf(sessionId: ID, database: AppDB): Promise<FlowExercise[]> {
  const detail = await getSessionDetail(sessionId, database);
  const { defaultRestSec } = await getSettings(database);
  return (detail?.exercises ?? []).map(({ exercise, sets }) => ({
    id: exercise.id,
    supersetGroup: exercise.supersetGroup,
    restSec: exercise.planned?.restSec ?? defaultRestSec,
    sets: sets.map((s) => ({ id: s.id, done: s.done })),
  }));
}

/**
 * Valide une série et lance le repos qui convient.
 * Renvoie la série suivante à faire (null si tout est fait) et la durée du repos lancé.
 */
export async function completeSet(
  id: ID,
  now: number = Date.now(),
  database: AppDB = db,
): Promise<{ nextSetId: ID | null; restSec: number }> {
  return database.transaction('rw', sessionTables(database), async () => {
    const set = await requireSet(id, database);
    if (set.weight === null) {
      throw new AppError('Indique la charge avant de valider (0 kg pour le poids du corps seul).');
    }
    if (set.reps === null || set.reps < 1) {
      throw new AppError('Indique le nombre de répétitions avant de valider.');
    }
    const flow = await flowOf(set.sessionId, database);
    const restSec = restAfter(flow, id);
    await database.sets.update(id, { done: true, completedAt: now, updatedAt: now });
    await setSetting(
      'restTimer',
      restSec > 0 ? { endsAt: now + restSec * 1000, totalSec: restSec } : null,
      database,
    );
    const after = flow.map((e) => ({
      ...e,
      sets: e.sets.map((s) => (s.id === id ? { ...s, done: true } : s)),
    }));
    return { nextSetId: nextSetId(after, id), restSec };
  });
}

/** Annule la validation d'une série (pour la corriger ou la refaire). */
export async function uncompleteSet(id: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.sets, async () => {
    await requireSet(id, database);
    await database.sets.update(id, { done: false, completedAt: null, updatedAt: Date.now() });
  });
}

/** Ajoute une série à un exercice, avec les valeurs de la série précédente. */
export async function addSet(sessionExerciseId: ID, database: AppDB = db): Promise<SetEntry> {
  return database.transaction('rw', [database.sessionExercises, database.sets], async () => {
    const exercise = await requireSessionExercise(sessionExerciseId, database);
    const sets = await database.sets.where('sessionExerciseId').equals(sessionExerciseId).sortBy('order');
    const previous = sets[sets.length - 1];
    const t = Date.now();
    const set: SetEntry = {
      id: newId(),
      sessionId: exercise.sessionId,
      sessionExerciseId,
      exerciseId: exercise.exerciseId,
      order: previous ? previous.order + 1 : 0,
      type: 'normal',
      weight: previous?.weight ?? null,
      reps: previous?.reps ?? exercise.planned?.repMin ?? DEFAULT_REPS,
      rpe: null,
      done: false,
      completedAt: null,
      createdAt: t,
      updatedAt: t,
    };
    await database.sets.add(set);
    return set;
  });
}

export async function removeSet(id: ID, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.sets, async () => {
    const set = await requireSet(id, database);
    const siblings = await database.sets
      .where('sessionExerciseId')
      .equals(set.sessionExerciseId)
      .sortBy('order');
    if (siblings.length <= 1) {
      throw new AppError('C’est la dernière série : retire plutôt l’exercice de la séance.');
    }
    await database.sets.delete(id);
    await Promise.all(
      siblings
        .filter((s) => s.id !== id)
        .map((s, index) => (s.order === index ? undefined : database.sets.update(s.id, { order: index }))),
    );
  });
}

// ---------- Minuteur de repos ----------

export async function adjustRest(deltaSec: number, now: number = Date.now(), database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const { restTimer } = await getSettings(database);
    if (!restTimer) return;
    await setSetting(
      'restTimer',
      {
        endsAt: Math.max(now, restTimer.endsAt + deltaSec * 1000),
        totalSec: Math.max(0, restTimer.totalSec + deltaSec),
      },
      database,
    );
  });
}

export async function clearRest(database: AppDB = db): Promise<void> {
  await setSetting('restTimer', null, database);
}

// ---------- Accueil : où en est-on aujourd'hui ? ----------

export interface TodayState {
  /** Séance en cours, avec son avancement. */
  active: { session: Session; doneSets: number; totalSets: number } | null;
  program: Program | null;
  workouts: ProgramWorkout[];
  plan: TodayPlan;
  /** La séance prévue aujourd'hui a été passée (mode jours fixes). */
  skipped: boolean;
  /** La séance prévue aujourd'hui (jours fixes) a déjà été faite. */
  plannedDone: boolean;
  /** Séances terminées aujourd'hui. */
  doneToday: Session[];
}

export async function getTodayState(now: number = Date.now(), database: AppDB = db): Promise<TodayState> {
  const today = localDate(now);
  const program = (await getActiveProgram(database)) ?? null;
  const workouts = program ? await listWorkouts(program.id, database) : [];
  const plan = plannedWorkoutFor(program ?? undefined, workouts, new Date(now));
  const { skippedDay } = await getSettings(database);
  const doneToday = (await database.sessions.where('date').equals(today).toArray())
    .filter((s) => s.status === 'done')
    .sort((a, b) => a.startedAt - b.startedAt);

  const session = await getActiveSession(database);
  let active: TodayState['active'] = null;
  if (session) {
    const sets = await database.sets.where('sessionId').equals(session.id).toArray();
    active = { session, doneSets: sets.filter((s) => s.done).length, totalSets: sets.length };
  }

  const plannedId = plan.kind === 'workout' ? plan.workout.id : null;
  const fixed = program?.scheduleMode === 'fixedDays';
  return {
    active,
    program,
    workouts,
    plan,
    skipped:
      fixed && plannedId !== null && skippedDay?.date === today && skippedDay.workoutId === plannedId,
    plannedDone: fixed && plannedId !== null && doneToday.some((s) => s.workoutId === plannedId),
    doneToday,
  };
}

/**
 * Passe la séance prévue.
 * Rotation : le cycle avance à la suivante. Jours fixes : la séance du jour est notée « passée ».
 */
export async function skipPlannedWorkout(now: number = Date.now(), database: AppDB = db): Promise<void> {
  await database.transaction('rw', sessionTables(database), async () => {
    const program = await getActiveProgram(database);
    if (!program) return;
    const workouts = await listWorkouts(program.id, database);
    const plan = plannedWorkoutFor(program, workouts, new Date(now));
    if (plan.kind !== 'workout') return;
    if (program.scheduleMode === 'rotation') {
      const index = program.rotation.indexOf(plan.workout.id);
      await database.programs.update(program.id, {
        nextRotationIndex: (index + 1) % program.rotation.length,
        updatedAt: now,
      });
    } else {
      await setSetting('skippedDay', { date: localDate(now), workoutId: plan.workout.id }, database);
    }
  });
}

/** Annule « passer » en mode jours fixes. */
export async function unskipToday(database: AppDB = db): Promise<void> {
  await setSetting('skippedDay', null, database);
}

// ---------- Écran de séance ----------

export interface SessionScreenExercise extends SessionExerciseDetail {
  history: ExerciseHistory;
  /** Séries de cette séance qui battent un record. */
  records: Map<ID, RecordKind[]>;
}

export interface SessionScreenData {
  session: Session;
  exercises: SessionScreenExercise[];
}

/** Tout ce que l'écran de séance affiche, y compris la dernière performance et les records. */
export async function getSessionScreenData(
  sessionId: ID,
  database: AppDB = db,
): Promise<SessionScreenData | null> {
  const detail = await getSessionDetail(sessionId, database);
  if (!detail) return null;
  const history = await getExercisesHistory(
    detail.exercises.map((e) => e.exercise.exerciseId),
    { excludeSessionId: sessionId, before: detail.session.startedAt },
    database,
  );
  // Un même exercice peut apparaître deux fois dans la séance : ses séries sont jugées ensemble.
  const recordsByExercise = new Map<ID, Map<ID, RecordKind[]>>();
  for (const exerciseId of new Set(detail.exercises.map((e) => e.exercise.exerciseId))) {
    const sets = detail.exercises
      .filter((e) => e.exercise.exerciseId === exerciseId)
      .flatMap((e) => e.sets);
    recordsByExercise.set(exerciseId, annotateRecords(history.get(exerciseId)?.lifts ?? [], sets));
  }
  return {
    session: detail.session,
    exercises: detail.exercises.map((e) => ({
      ...e,
      history: history.get(e.exercise.exerciseId) ?? { last: null, lifts: [] },
      records: recordsByExercise.get(e.exercise.exerciseId) ?? new Map(),
    })),
  };
}

// ---------- Bilan de fin de séance ----------

export interface SessionTotals {
  durationSec: number;
  volume: number;
  /** Nombre de séries qui comptent (hors échauffement). */
  setCount: number;
}

export interface SessionSummary {
  session: Session;
  totals: SessionTotals;
  exercises: {
    id: ID;
    name: string;
    note: string;
    sets: SetEntry[];
    volume: number;
    /** Volume du même exercice lors de la séance précédente comparable, s'il y était. */
    previousVolume: number | null;
  }[];
  records: { setId: ID; exerciseName: string; weight: number; reps: number; kinds: RecordKind[] }[];
  /** Même séance du programme, la fois précédente. */
  previous: { session: Session; totals: SessionTotals } | null;
}

export function totalsOf(session: Session, sets: SetEntry[]): SessionTotals {
  return {
    durationSec: Math.max(0, Math.round(((session.endedAt ?? session.startedAt) - session.startedAt) / 1000)),
    volume: totalVolume(sets),
    setCount: sets.filter(isCountedSet).length,
  };
}

export async function getSessionSummary(
  sessionId: ID,
  database: AppDB = db,
): Promise<SessionSummary | null> {
  const data = await getSessionScreenData(sessionId, database);
  if (!data) return null;
  const { session } = data;
  const allSets = data.exercises.flatMap((e) => e.sets);

  let previous: SessionSummary['previous'] = null;
  const previousVolumes = new Map<ID, number>();
  if (session.workoutId) {
    const candidates = (await database.sessions.where('workoutId').equals(session.workoutId).toArray())
      .filter((s) => s.status === 'done' && s.id !== session.id && s.startedAt < session.startedAt)
      .sort((a, b) => b.startedAt - a.startedAt);
    const before = candidates[0];
    if (before) {
      const sets = await database.sets.where('sessionId').equals(before.id).toArray();
      previous = { session: before, totals: totalsOf(before, sets) };
      for (const exerciseId of new Set(sets.map((s) => s.exerciseId))) {
        previousVolumes.set(exerciseId, totalVolume(sets.filter((s) => s.exerciseId === exerciseId)));
      }
    }
  }

  return {
    session,
    totals: totalsOf(session, allSets),
    exercises: data.exercises.map((e) => ({
      id: e.exercise.id,
      name: e.exercise.exerciseName,
      note: e.exercise.note,
      sets: e.sets,
      volume: totalVolume(e.sets),
      previousVolume: previousVolumes.get(e.exercise.exerciseId) ?? null,
    })),
    records: data.exercises.flatMap((e) =>
      e.sets.flatMap((set) => {
        const kinds = e.records.get(set.id);
        return kinds && isCountedSet(set)
          ? [{ setId: set.id, exerciseName: e.exercise.exerciseName, weight: set.weight, reps: set.reps, kinds }]
          : [];
      }),
    ),
    previous,
  };
}
