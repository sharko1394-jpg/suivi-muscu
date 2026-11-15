import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from './builtinExercises';
import {
  createExercise,
  listExercises,
  seedBuiltinExercises,
  setExerciseArchived,
  updateExercise,
} from './exercises';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from './labels';
import { AppError, normalizeText } from './util';
import { freshDb } from '../test/helpers';

describe('exercices fournis avec l’appli', () => {
  it('ont des identifiants et des noms uniques, et des valeurs connues', () => {
    expect(new Set(BUILTIN_EXERCISES.map((e) => e.id)).size).toBe(BUILTIN_EXERCISES.length);
    expect(new Set(BUILTIN_EXERCISES.map((e) => normalizeText(e.name))).size).toBe(
      BUILTIN_EXERCISES.length,
    );
    for (const e of BUILTIN_EXERCISES) {
      expect(e.primaryMuscle in MUSCLE_LABELS).toBe(true);
      expect(e.equipment in EQUIPMENT_LABELS).toBe(true);
      for (const m of e.secondaryMuscles) {
        expect(m in MUSCLE_LABELS).toBe(true);
        expect(m).not.toBe(e.primaryMuscle);
      }
    }
  });

  it('sont ajoutés une seule fois, même si on relance l’appli', async () => {
    const database = await freshDb();
    expect(await seedBuiltinExercises(database)).toBe(BUILTIN_EXERCISES.length);
    expect(await seedBuiltinExercises(database)).toBe(0);
    expect(await database.exercises.count()).toBe(BUILTIN_EXERCISES.length);
    database.close();
  });

  it('une relance ne défait pas mes modifications', async () => {
    const database = await freshDb();
    await seedBuiltinExercises(database);
    const id = BUILTIN_EXERCISES[0].id;
    await updateExercise(
      id,
      { name: 'Mon développé', primaryMuscle: 'pectoraux', secondaryMuscles: [], equipment: 'barre' },
      database,
    );
    await setExerciseArchived(BUILTIN_EXERCISES[1].id, true, database);

    await seedBuiltinExercises(database);
    expect((await database.exercises.get(id))?.name).toBe('Mon développé');
    expect((await database.exercises.get(BUILTIN_EXERCISES[1].id))?.archived).toBe(true);
    database.close();
  });
});

describe('mes exercices', () => {
  const input = {
    name: '  Tirage   poulie maison ',
    primaryMuscle: 'dos' as const,
    secondaryMuscles: ['biceps' as const, 'dos' as const, 'biceps' as const],
    equipment: 'poulie' as const,
  };

  it('création : nom nettoyé, muscles secondaires dédoublonnés', async () => {
    const database = await freshDb();
    const created = await createExercise(input, database);
    expect(created.name).toBe('Tirage poulie maison');
    expect(created.secondaryMuscles).toEqual(['biceps']);
    expect(created.isCustom).toBe(true);
    expect(await database.exercises.get(created.id)).toEqual(created);
    database.close();
  });

  it('refuse un nom vide ou déjà pris (même avec d’autres accents ou majuscules)', async () => {
    const database = await freshDb();
    await seedBuiltinExercises(database);
    await expect(createExercise({ ...input, name: '   ' }, database)).rejects.toThrow(AppError);
    await expect(
      createExercise({ ...input, name: 'developpe couche (BARRE)' }, database),
    ).rejects.toThrow(AppError);
    expect(await database.exercises.count()).toBe(BUILTIN_EXERCISES.length);
    database.close();
  });

  it('on peut renommer un exercice sans changer son nom par ailleurs', async () => {
    const database = await freshDb();
    const created = await createExercise(input, database);
    await updateExercise(created.id, { ...input, name: 'Tirage poulie maison', equipment: 'machine' }, database);
    expect((await database.exercises.get(created.id))?.equipment).toBe('machine');
    database.close();
  });

  it('masquer retire de la liste sans supprimer', async () => {
    const database = await freshDb();
    const created = await createExercise(input, database);
    await setExerciseArchived(created.id, true, database);
    expect(await listExercises({}, database)).toHaveLength(0);
    expect(await listExercises({ includeArchived: true }, database)).toHaveLength(1);
    database.close();
  });

  it('la liste est triée par ordre alphabétique français', async () => {
    const database = await freshDb();
    for (const name of ['Zercher', 'Écarté maison', 'abdos maison']) {
      await createExercise({ ...input, name }, database);
    }
    expect((await listExercises({}, database)).map((e) => e.name)).toEqual([
      'abdos maison',
      'Écarté maison',
      'Zercher',
    ]);
    database.close();
  });
});
