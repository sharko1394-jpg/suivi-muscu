import { db, type AppDB } from './db';
import { seedBuiltinExercises } from './exercises';
import { SET_TYPE_LABELS } from './labels';
import { SCHEMA_VERSIONS, latestVersion, migrateDump, type SchemaVersion } from './schema';
import { ensureFirstLaunch, setSetting } from './settings';
import type { Dump, Exercise, Session } from './types';
import { DAY_MS, AppError } from './util';

/** Signature des fichiers de sauvegarde. NE JAMAIS LA CHANGER. */
export const BACKUP_APP_ID = 'suivi-muscu';
export const BACKUP_REMINDER_DAYS = 14;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  /** Version de la base au moment de l'export : indique quelles migrations appliquer à l'import. */
  formatVersion: number;
  exportedAt: string;
  appVersion: string;
  data: Dump;
}

export interface DataCounts {
  sessions: number;
  programs: number;
  exercises: number;
  customExercises: number;
  bodyweights: number;
}

// ---------- Export ----------

/** Copie complète de la base, lue en une seule fois pour être cohérente. */
export async function exportBackup(
  appVersion: string,
  database: AppDB = db,
): Promise<BackupFile> {
  const data: Dump = {};
  await database.transaction('r', database.tables, async () => {
    for (const table of database.tables) {
      data[table.name] = await table.toArray();
    }
  });
  return {
    app: BACKUP_APP_ID,
    formatVersion: database.verno,
    exportedAt: new Date().toISOString(),
    appVersion,
    data,
  };
}

export function backupFileName(now: number = Date.now()): string {
  return `suivi-muscu-${stamp(now, true)}.json`;
}

export function csvFileName(now: number = Date.now()): string {
  return `suivi-muscu-historique-${stamp(now, false)}.csv`;
}

function stamp(timestamp: number, withTime: boolean): string {
  const d = new Date(timestamp);
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return withTime ? `${day}-${p(d.getHours())}${p(d.getMinutes())}` : day;
}

// ---------- Import ----------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lit et vérifie un fichier de sauvegarde. Ne touche pas à la base. */
export function parseBackup(
  text: string,
  versions: SchemaVersion[] = SCHEMA_VERSIONS,
): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError('Ce fichier est illisible : ce n’est pas une sauvegarde valide.');
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP_ID) {
    throw new AppError('Ce fichier n’est pas une sauvegarde de cette appli.');
  }
  const { formatVersion, exportedAt, data } = raw;
  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion) || formatVersion < 1) {
    throw new AppError('Cette sauvegarde est abîmée (version inconnue).');
  }
  if (formatVersion > latestVersion(versions)) {
    throw new AppError(
      'Cette sauvegarde vient d’une version plus récente de l’appli. Mets l’appli à jour, puis réessaie.',
    );
  }
  if (typeof exportedAt !== 'string' || Number.isNaN(Date.parse(exportedAt))) {
    throw new AppError('Cette sauvegarde est abîmée (date manquante).');
  }
  if (!isObject(data)) {
    throw new AppError('Cette sauvegarde est abîmée (données manquantes).');
  }
  for (const rows of Object.values(data)) {
    if (!Array.isArray(rows) || rows.some((row) => !isObject(row))) {
      throw new AppError('Cette sauvegarde est abîmée (contenu illisible).');
    }
  }
  return {
    app: BACKUP_APP_ID,
    formatVersion,
    exportedAt,
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : '?',
    data: data as Dump,
  };
}

/** Données du fichier amenées à la version courante (les migrations nécessaires sont appliquées). */
export function backupToCurrentData(
  file: BackupFile,
  versions: SchemaVersion[] = SCHEMA_VERSIONS,
): Dump {
  try {
    return migrateDump(file.data, file.formatVersion, versions);
  } catch {
    throw new AppError('Cette sauvegarde n’a pas pu être convertie au format actuel.');
  }
}

/**
 * Remplace toutes les données par celles du fichier.
 * Tout se fait en une seule transaction : en cas d'erreur, rien n'est modifié.
 */
export async function importBackup(
  file: BackupFile,
  database: AppDB = db,
  versions: SchemaVersion[] = SCHEMA_VERSIONS,
): Promise<void> {
  const data = backupToCurrentData(file, versions);

  for (const table of database.tables) {
    const keyPath = table.schema.primKey.keyPath as string;
    for (const row of data[table.name] ?? []) {
      const key = (row as Record<string, unknown>)[keyPath];
      if (typeof key !== 'string' || key.length === 0) {
        throw new AppError('Cette sauvegarde est abîmée (ligne sans identifiant).');
      }
    }
  }

  try {
    await database.transaction('rw', database.tables, async () => {
      for (const table of database.tables) {
        await table.clear();
        await table.bulkAdd(data[table.name] ?? []);
      }
      // Les données sont maintenant identiques au fichier : il compte comme dernière sauvegarde.
      await setSetting('lastBackupAt', Date.parse(file.exportedAt), database);
      await setSetting('backupSnoozedUntil', null, database);
    });
  } catch {
    throw new AppError(
      'La restauration a échoué : le fichier contient des données incohérentes. Tes données actuelles n’ont pas été modifiées.',
    );
  }

  await ensureFirstLaunch(database);
  await seedBuiltinExercises(database);
}

// ---------- Résumés ----------

export function countsFromDump(data: Dump): DataCounts {
  const sessions = (data.sessions ?? []) as Session[];
  const exercises = (data.exercises ?? []) as Exercise[];
  return {
    sessions: sessions.filter((s) => s.status === 'done').length,
    programs: (data.programs ?? []).length,
    exercises: exercises.length,
    customExercises: exercises.filter((e) => e.isCustom).length,
    bodyweights: (data.bodyweights ?? []).length,
  };
}

export async function getDataCounts(database: AppDB = db): Promise<DataCounts> {
  const [sessions, programs, exercises, bodyweights] = await Promise.all([
    database.sessions.where('status').equals('done').count(),
    database.programs.count(),
    database.exercises.toArray(),
    database.bodyweights.count(),
  ]);
  return {
    sessions,
    programs,
    exercises: exercises.length,
    customExercises: exercises.filter((e) => e.isCustom).length,
    bodyweights,
  };
}

/** Y a-t-il quelque chose que l'utilisateur regretterait de perdre ? */
export function hasUserData(counts: DataCounts): boolean {
  return (
    counts.sessions > 0 || counts.programs > 0 || counts.customExercises > 0 || counts.bodyweights > 0
  );
}

// ---------- Rappel de sauvegarde ----------

export function isBackupDue(input: {
  now: number;
  lastBackupAt: number | null;
  firstLaunchAt: number | null;
  snoozedUntil: number | null;
  hasUserData: boolean;
}): boolean {
  if (!input.hasUserData) return false;
  if (input.snoozedUntil !== null && input.now < input.snoozedUntil) return false;
  const reference = input.lastBackupAt ?? input.firstLaunchAt;
  if (reference === null) return false;
  return input.now - reference > BACKUP_REMINDER_DAYS * DAY_MS;
}

export async function markBackupDone(database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    await setSetting('lastBackupAt', Date.now(), database);
    await setSetting('backupSnoozedUntil', null, database);
  });
}

export async function snoozeBackupReminder(days = 3, database: AppDB = db): Promise<void> {
  await setSetting('backupSnoozedUntil', Date.now() + days * DAY_MS, database);
}

// ---------- Export CSV de l'historique ----------

const CSV_HEADER = [
  'Date',
  'Heure',
  'Programme',
  'Séance',
  'Exercice',
  'Série',
  'Type',
  'Charge (kg)',
  'Répétitions',
  'RPE',
  'Note exercice',
  'Note séance',
];

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  // Virgule décimale et point-virgule : le format attendu par un tableur en français.
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Une ligne par série validée de chaque séance terminée, de la plus ancienne à la plus récente. */
export async function buildHistoryCsv(database: AppDB = db): Promise<string> {
  const [sessions, sessionExercises, sets] = await database.transaction(
    'r',
    [database.sessions, database.sessionExercises, database.sets],
    () =>
      Promise.all([
        database.sessions.where('status').equals('done').sortBy('startedAt'),
        database.sessionExercises.toArray(),
        database.sets.toArray(),
      ]),
  );

  const lines = [CSV_HEADER.join(';')];
  for (const session of sessions) {
    const start = new Date(session.startedAt);
    const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    const exercises = sessionExercises
      .filter((e) => e.sessionId === session.id)
      .sort((a, b) => a.order - b.order);
    for (const exercise of exercises) {
      const done = sets
        .filter((s) => s.sessionExerciseId === exercise.id && s.done)
        .sort((a, b) => a.order - b.order);
      done.forEach((set, index) => {
        lines.push(
          [
            session.date,
            time,
            session.programName,
            session.workoutName,
            exercise.exerciseName,
            index + 1,
            SET_TYPE_LABELS[set.type],
            set.weight,
            set.reps,
            set.rpe,
            exercise.note,
            session.note,
          ]
            .map(csvCell)
            .join(';'),
        );
      });
    }
  }
  // BOM : indique l'encodage UTF-8 au tableur, pour que les accents s'affichent bien.
  return '﻿' + lines.join('\r\n') + '\r\n';
}
