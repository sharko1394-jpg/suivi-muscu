import Dexie, { type Table } from 'dexie';
import { DB_NAME, SCHEMA_VERSIONS, type SchemaVersion } from './schema';
import type {
  Bodyweight,
  Dump,
  Exercise,
  Program,
  ProgramWorkout,
  Session,
  SessionExercise,
  SetEntry,
  SettingRow,
} from './types';

export class AppDB extends Dexie {
  exercises!: Table<Exercise, string>;
  programs!: Table<Program, string>;
  programWorkouts!: Table<ProgramWorkout, string>;
  sessions!: Table<Session, string>;
  sessionExercises!: Table<SessionExercise, string>;
  sets!: Table<SetEntry, string>;
  bodyweights!: Table<Bodyweight, string>;
  settings!: Table<SettingRow, string>;
}

/**
 * Construit la base à partir de l'historique des versions.
 * Chaque migration s'exécute dans la transaction de mise à niveau :
 * si elle échoue, rien n'est modifié et la base reste à l'ancienne version.
 */
export function createDb(
  name: string = DB_NAME,
  versions: SchemaVersion[] = SCHEMA_VERSIONS,
): AppDB {
  const database = new AppDB(name);

  for (const v of versions) {
    const declared = database.version(v.version).stores(v.stores);
    const migrate = v.migrate;
    if (!migrate) continue;

    declared.upgrade(async (tx) => {
      const before: Dump = {};
      for (const table of tx.storeNames) {
        before[table] = await tx.table(table).toArray();
      }
      const after = migrate(before);
      for (const table of tx.storeNames) {
        // Un tiroir non touché par la migration n'est pas réécrit.
        if (after[table] === undefined || after[table] === before[table]) continue;
        await tx.table(table).clear();
        await tx.table(table).bulkAdd(after[table]);
      }
    });
  }

  return database;
}

/** La base de l'appli. Seul le dossier src/data y accède directement. */
export const db = createDb();
