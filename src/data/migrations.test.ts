import { describe, expect, it } from 'vitest';
import { createDb } from './db';
import { CURRENT_VERSION, SCHEMA_VERSIONS, migrateDump, tableNames, type SchemaVersion } from './schema';
import type { Bodyweight, Dump, Exercise } from './types';
import { dumpOf, fillSampleData, freshName } from '../test/helpers';

describe('historique des versions de la base', () => {
  it('la version 1 est figée : la modifier casserait les bases déjà installées', () => {
    expect(SCHEMA_VERSIONS[0]).toEqual({
      version: 1,
      description: 'Schéma initial',
      stores: {
        exercises: 'id, name, primaryMuscle',
        programs: 'id, status',
        programWorkouts: 'id, programId',
        sessions: 'id, startedAt, date, status, workoutId',
        sessionExercises: 'id, sessionId, exerciseId',
        sets: 'id, sessionId, sessionExerciseId, exerciseId',
        bodyweights: 'id, &date',
        settings: 'key',
      },
    });
  });

  it('les versions se suivent sans trou : 1, 2, 3…', () => {
    SCHEMA_VERSIONS.forEach((v, index) => expect(v.version).toBe(index + 1));
    expect(CURRENT_VERSION).toBe(SCHEMA_VERSIONS.length);
  });

  it('la base ouverte contient exactement les tiroirs déclarés', async () => {
    const database = createDb(freshName());
    await database.open();
    expect(database.tables.map((t) => t.name).sort()).toEqual(tableNames().sort());
    expect(database.verno).toBe(CURRENT_VERSION);
    database.close();
  });
});

// Versions fictives, pour vérifier le mécanisme de migration lui-même.
const V2_TEST: SchemaVersion = {
  version: 2,
  description: 'test : nouveau champ sur les exercices, nouveau tiroir',
  stores: { tags: 'id' },
  migrate: (dump) => ({
    ...dump,
    exercises: (dump.exercises as Exercise[]).map((e) => ({ ...e, favorite: e.isCustom })),
    tags: [{ id: 'tag-1', label: 'créé par la migration' }],
  }),
};

const V3_TEST: SchemaVersion = {
  version: 3,
  description: 'test : champ renommé et nouvel index',
  stores: { bodyweights: 'id, &date, kg' },
  migrate: (dump) => ({
    ...dump,
    bodyweights: (dump.bodyweights as Bodyweight[]).map(({ weightKg, ...rest }) => ({
      ...rest,
      kg: weightKg,
    })),
  }),
};

describe('mise à jour de la base', () => {
  it('une mise à jour sans changement de schéma garde tout à l’identique', async () => {
    const name = freshName();
    const before = createDb(name);
    await before.open();
    await fillSampleData(before);
    const expected = await dumpOf(before);
    before.close();

    // « Nouvelle version de l'appli » : même base, rouverte.
    const after = createDb(name);
    await after.open();
    expect(await dumpOf(after)).toEqual(expected);
    after.close();
  });

  it('les migrations transforment les données sans rien perdre', async () => {
    const name = freshName();
    const v1 = createDb(name, SCHEMA_VERSIONS.slice(0, 1));
    await v1.open();
    await fillSampleData(v1);
    const before = await dumpOf(v1);
    v1.close();

    const v3 = createDb(name, [SCHEMA_VERSIONS[0], V2_TEST, V3_TEST]);
    await v3.open();
    const after = await dumpOf(v3);
    expect(v3.verno).toBe(3);

    // Tiroirs non concernés : strictement identiques.
    for (const table of ['programs', 'programWorkouts', 'sessions', 'sessionExercises', 'sets', 'settings']) {
      expect(after[table]).toEqual(before[table]);
    }
    // Exercices : mêmes lignes, avec le nouveau champ.
    expect(after.exercises).toHaveLength(before.exercises.length);
    expect(after.exercises).toEqual(
      (before.exercises as Exercise[]).map((e) => ({ ...e, favorite: e.isCustom })),
    );
    // Pesées : champ renommé, valeurs conservées, nouvel index utilisable.
    expect((after.bodyweights as { kg: number }[]).map((b) => b.kg)).toEqual([78.4, 78.1]);
    expect(await v3.table('bodyweights').where('kg').above(78.2).count()).toBe(1);
    // Nouveau tiroir rempli par la migration.
    expect(after.tags).toEqual([{ id: 'tag-1', label: 'créé par la migration' }]);
    v3.close();
  });

  it('une migration qui échoue ne modifie rien : la base reste à l’ancienne version', async () => {
    const name = freshName();
    const v1 = createDb(name, SCHEMA_VERSIONS.slice(0, 1));
    await v1.open();
    await fillSampleData(v1);
    const before = await dumpOf(v1);
    v1.close();

    const broken: SchemaVersion = {
      version: 2,
      description: 'test : migration défectueuse',
      stores: { tags: 'id' },
      migrate: () => {
        throw new Error('bug dans la migration');
      },
    };
    const failing = createDb(name, [SCHEMA_VERSIONS[0], broken]);
    await expect(failing.open()).rejects.toThrow();
    failing.close();

    const again = createDb(name, SCHEMA_VERSIONS.slice(0, 1));
    await again.open();
    expect(again.verno).toBe(1);
    expect(await dumpOf(again)).toEqual(before);
    again.close();
  });

  it('une sauvegarde ancienne passe par les mêmes migrations que la base', () => {
    const old: Dump = {
      exercises: [{ id: 'e1', isCustom: true }, { id: 'e2', isCustom: false }],
      bodyweights: [{ id: 'b1', date: '2026-01-01', weightKg: 80 }],
      sets: [{ id: 's1' }],
    };
    const versions = [SCHEMA_VERSIONS[0], V2_TEST, V3_TEST];

    const fromV1 = migrateDump(old, 1, versions);
    expect(fromV1.exercises).toEqual([
      { id: 'e1', isCustom: true, favorite: true },
      { id: 'e2', isCustom: false, favorite: false },
    ]);
    expect(fromV1.bodyweights).toEqual([{ id: 'b1', date: '2026-01-01', kg: 80 }]);
    expect(fromV1.sets).toBe(old.sets);

    // Une sauvegarde déjà en version 2 ne repasse pas par la migration 2.
    const fromV2 = migrateDump(old, 2, versions);
    expect(fromV2.exercises).toBe(old.exercises);
    expect(fromV2.bodyweights).toEqual([{ id: 'b1', date: '2026-01-01', kg: 80 }]);

    // Déjà à jour : rien ne change.
    expect(migrateDump(old, 3, versions)).toBe(old);
  });
});
