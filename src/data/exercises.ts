import { db, type AppDB } from './db';
import { BUILTIN_EXERCISES } from './builtinExercises';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from './labels';
import type { Equipment, Exercise, Muscle } from './types';
import { AppError, newId, normalizeText } from './util';

export interface ExerciseInput {
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  /** Pas des boutons − et + propre à cet exercice, en kg ; null ou absent = réglage général. */
  weightStep?: number | null;
}

const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name, 'fr');

/**
 * Ajoute les exercices fournis avec l'appli qui manquent dans la base.
 * Ne modifie jamais un exercice existant : sans risque à chaque démarrage.
 */
export async function seedBuiltinExercises(database: AppDB = db): Promise<number> {
  return database.transaction('rw', database.exercises, async () => {
    const existing = new Set(await database.exercises.toCollection().primaryKeys());
    const t = Date.now();
    const missing: Exercise[] = BUILTIN_EXERCISES.filter((b) => !existing.has(b.id)).map((b) => ({
      ...b,
      isCustom: false,
      archived: false,
      weightStep: null,
      createdAt: t,
      updatedAt: t,
    }));
    if (missing.length > 0) await database.exercises.bulkAdd(missing);
    return missing.length;
  });
}

export async function listExercises(
  options: { includeArchived?: boolean } = {},
  database: AppDB = db,
): Promise<Exercise[]> {
  const all = await database.exercises.toArray();
  return all.filter((e) => options.includeArchived || !e.archived).sort(byName);
}

export function getExercise(id: string, database: AppDB = db): Promise<Exercise | undefined> {
  return database.exercises.get(id);
}

async function validate(
  input: ExerciseInput,
  ignoreId: string | null,
  database: AppDB,
): Promise<Required<ExerciseInput>> {
  const name = input.name.replace(/\s+/g, ' ').trim();
  if (name.length === 0) throw new AppError('Donne un nom à l’exercice.');
  if (name.length > 80) throw new AppError('Le nom est trop long (80 caractères maximum).');
  if (!(input.primaryMuscle in MUSCLE_LABELS)) throw new AppError('Choisis un groupe musculaire.');
  if (!(input.equipment in EQUIPMENT_LABELS)) throw new AppError('Choisis un type de matériel.');

  const key = normalizeText(name);
  const duplicate = (await database.exercises.toArray()).find(
    (e) => e.id !== ignoreId && normalizeText(e.name) === key,
  );
  if (duplicate) {
    throw new AppError(
      duplicate.archived
        ? 'Un exercice masqué porte déjà ce nom. Réaffiche-le plutôt que d’en créer un autre.'
        : 'Un exercice porte déjà ce nom.',
    );
  }

  const secondaryMuscles = [...new Set(input.secondaryMuscles)].filter(
    (m) => m in MUSCLE_LABELS && m !== input.primaryMuscle,
  );
  const step = input.weightStep ?? null;
  if (step !== null && !(Number.isFinite(step) && step > 0 && step <= 50)) {
    throw new AppError('Le pas de charge doit être compris entre 0 et 50 kg.');
  }
  return {
    name,
    primaryMuscle: input.primaryMuscle,
    secondaryMuscles,
    equipment: input.equipment,
    weightStep: step,
  };
}

export async function createExercise(input: ExerciseInput, database: AppDB = db): Promise<Exercise> {
  return database.transaction('rw', database.exercises, async () => {
    const clean = await validate(input, null, database);
    const t = Date.now();
    const exercise: Exercise = {
      id: newId(),
      ...clean,
      isCustom: true,
      archived: false,
      createdAt: t,
      updatedAt: t,
    };
    await database.exercises.add(exercise);
    return exercise;
  });
}

/**
 * Modifie un exercice. L'historique n'est pas touché :
 * chaque séance réalisée garde sa propre copie du nom et des muscles.
 */
export async function updateExercise(
  id: string,
  input: ExerciseInput,
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.exercises, async () => {
    const existing = await database.exercises.get(id);
    if (!existing) throw new AppError('Cet exercice n’existe plus.');
    const { weightStep, ...clean } = await validate(input, id, database);
    await database.exercises.update(id, {
      ...clean,
      // Pas de charge non précisé : on garde celui qui était réglé.
      ...(input.weightStep === undefined ? {} : { weightStep }),
      updatedAt: Date.now(),
    });
  });
}

/** Masque (ou réaffiche) un exercice sans rien supprimer. */
export async function setExerciseArchived(
  id: string,
  archived: boolean,
  database: AppDB = db,
): Promise<void> {
  await database.exercises.update(id, { archived, updatedAt: Date.now() });
}
