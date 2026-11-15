import type { Dump } from './types';

/**
 * Nom de la base sur le téléphone.
 * NE JAMAIS LE CHANGER : toutes les données de l'utilisateur y sont attachées.
 */
export const DB_NAME = 'suivi-muscu';

export interface SchemaVersion {
  version: number;
  description: string;
  /** Tiroirs et index (syntaxe Dexie). Seuls les changements sont à déclarer. */
  stores: Record<string, string | null>;
  /**
   * Transforme les données de la version précédente vers celle-ci.
   * Fonction pure : elle sert à la fois à mettre à jour la base du téléphone
   * et à relire une ancienne sauvegarde. Ne remplacer que les tiroirs modifiés.
   */
  migrate?: (dump: Dump) => Dump;
}

/**
 * Historique des versions de la base.
 *
 * RÈGLES :
 *  - ne jamais modifier ni supprimer une version déjà mise en ligne ;
 *  - tout changement = une nouvelle entrée à la fin, avec sa migration et son test ;
 *  - ne jamais renommer, vider ou recréer la base.
 */
export const SCHEMA_VERSIONS: SchemaVersion[] = [
  {
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
  },
];

export const CURRENT_VERSION = latestVersion(SCHEMA_VERSIONS);

export function latestVersion(versions: SchemaVersion[]): number {
  return versions[versions.length - 1].version;
}

/** Tiroirs existant à la dernière version. */
export function tableNames(versions: SchemaVersion[] = SCHEMA_VERSIONS): string[] {
  const names = new Set<string>();
  for (const v of versions) {
    for (const [name, def] of Object.entries(v.stores)) {
      if (def === null) names.delete(name);
      else names.add(name);
    }
  }
  return [...names];
}

/** Fait passer des données brutes d'une ancienne version à la version courante. */
export function migrateDump(
  dump: Dump,
  fromVersion: number,
  versions: SchemaVersion[] = SCHEMA_VERSIONS,
): Dump {
  let current = dump;
  for (const v of versions) {
    if (v.version > fromVersion && v.migrate) current = v.migrate(current);
  }
  return current;
}
