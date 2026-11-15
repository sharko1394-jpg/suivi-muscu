import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BACKUP_REMINDER_DAYS,
  backupFileName,
  buildHistoryCsv,
  countsFromDump,
  exportBackup,
  getDataCounts,
  hasUserData,
  importBackup,
  isBackupDue,
  parseBackup,
  type BackupFile,
} from './backup';
import { BUILTIN_EXERCISES } from './builtinExercises';
import { createDb } from './db';
import { SCHEMA_VERSIONS, type SchemaVersion } from './schema';
import { getSettings } from './settings';
import type { Dump, Exercise } from './types';
import { DAY_MS, AppError } from './util';
import { dumpOf, fillSampleData, freshDb, freshName } from '../test/helpers';

/** Comme le fichier réel : passage par du texte JSON. */
const throughFile = (backup: BackupFile) => parseBackup(JSON.stringify(backup));

/** Les réglages liés à la sauvegarde changent à l'import : on les met de côté pour comparer. */
function withoutBackupSettings(dump: Dump): Dump {
  const ignored = new Set(['lastBackupAt', 'backupSnoozedUntil']);
  return {
    ...dump,
    settings: (dump.settings as { key: string }[]).filter((row) => !ignored.has(row.key)),
  };
}

describe('export puis import', () => {
  it('j’exporte, je désinstalle, je réinstalle, j’importe : tout revient', async () => {
    const name = freshName();
    const phone = createDb(name);
    await phone.open();
    await fillSampleData(phone);
    const before = await dumpOf(phone);
    const file = JSON.stringify(await exportBackup('0.1.0', phone));

    // Désinstallation : la base disparaît avec l'appli.
    await phone.delete();

    // Réinstallation : base neuve, puis restauration du fichier.
    const reinstalled = createDb(name);
    await reinstalled.open();
    expect(await reinstalled.sessions.count()).toBe(0);
    await importBackup(parseBackup(file), reinstalled);

    const after = await dumpOf(reinstalled);
    expect(withoutBackupSettings(after)).toEqual(withoutBackupSettings(before));
    expect(after.sessions).toHaveLength(2);
    expect(after.sets).toHaveLength(5);
    reinstalled.close();
  });

  it('le fichier de sauvegarde contient tous les tiroirs et sa version', async () => {
    const database = await freshDb();
    await fillSampleData(database);
    const backup = await exportBackup('1.2.3', database);
    expect(backup.app).toBe('suivi-muscu');
    expect(backup.formatVersion).toBe(database.verno);
    expect(backup.appVersion).toBe('1.2.3');
    expect(Object.keys(backup.data).sort()).toEqual(database.tables.map((t) => t.name).sort());
    database.close();
  });

  it('l’import remplace les données présentes, sans mélange', async () => {
    const source = await freshDb();
    await fillSampleData(source);
    const backup = throughFile(await exportBackup('0.1.0', source));

    const target = await freshDb();
    await target.bodyweights.add({ id: 'autre', date: '2025-01-01', weightKg: 99, createdAt: 1, updatedAt: 1 });
    await target.settings.put({ key: 'weightStep', value: 5, updatedAt: 1 });

    await importBackup(backup, target);
    expect(await target.bodyweights.get('autre')).toBeUndefined();
    expect((await getSettings(target)).weightStep).toBe(1.25);
    expect(withoutBackupSettings(await dumpOf(target))).toEqual(
      withoutBackupSettings(await dumpOf(source)),
    );
    source.close();
    target.close();
  });

  it('après un import, le fichier compte comme dernière sauvegarde', async () => {
    const source = await freshDb();
    await fillSampleData(source);
    const backup = throughFile(await exportBackup('0.1.0', source));
    const target = await freshDb();
    await importBackup(backup, target);
    const settings = await getSettings(target);
    expect(settings.lastBackupAt).toBe(Date.parse(backup.exportedAt));
    expect(settings.backupSnoozedUntil).toBeNull();
    source.close();
    target.close();
  });

  it('une sauvegarde de la version 1 reste importable (fichier témoin)', async () => {
    const text = readFileSync(new URL('../test/fixtures/backup-v1.json', import.meta.url), 'utf8');
    const backup = parseBackup(text);
    const database = await freshDb();
    await importBackup(backup, database);

    expect(await database.sessions.count()).toBe(1);
    expect(await database.sets.count()).toBe(2);
    expect(await database.programs.count()).toBe(1);
    expect((await database.programWorkouts.get('wk-1'))?.items[0].note).toBe('banc n° 2');
    expect((await database.exercises.get('7f6c1c1e-0000-4000-8000-000000000001'))?.name).toBe(
      'Presse inclinée du club',
    );
    expect((await database.bodyweights.get('bw-1'))?.weightKg).toBe(78.4);
    // Les exercices de base absents du fichier sont rajoutés, sans doublon.
    expect(await database.exercises.count()).toBe(BUILTIN_EXERCISES.length + 1);
    database.close();
  });

  it('une sauvegarde d’une ancienne version est convertie à l’import', async () => {
    const v2: SchemaVersion = {
      version: 2,
      description: 'test : nouveau champ',
      stores: {},
      migrate: (dump) => ({
        ...dump,
        exercises: (dump.exercises as Exercise[]).map((e) => ({ ...e, favorite: false })),
      }),
    };
    const versions = [SCHEMA_VERSIONS[0], v2];

    const oldPhone = await freshDb(SCHEMA_VERSIONS.slice(0, 1));
    await fillSampleData(oldPhone);
    const oldFile = JSON.stringify(await exportBackup('0.1.0', oldPhone));
    expect(JSON.parse(oldFile).formatVersion).toBe(1);

    const newPhone = createDb(freshName(), versions);
    await newPhone.open();
    await importBackup(parseBackup(oldFile, versions), newPhone, versions);
    const custom = (await newPhone.exercises.get('custom-1')) as Exercise & { favorite?: boolean };
    expect(custom.favorite).toBe(false);
    expect(custom.name).toBe('Tirage « maison »');
    oldPhone.close();
    newPhone.close();
  });
});

describe('fichiers refusés', () => {
  const valid = {
    app: 'suivi-muscu',
    formatVersion: 1,
    exportedAt: '2026-11-15T10:00:00.000Z',
    appVersion: '0.1.0',
    data: { exercises: [] },
  };

  it.each([
    ['du texte quelconque', 'bonjour'],
    ['un JSON sans rapport', JSON.stringify({ hello: 'world' })],
    ['une liste', JSON.stringify([1, 2, 3])],
    ['une autre appli', JSON.stringify({ ...valid, app: 'autre-appli' })],
    ['une version absente', JSON.stringify({ ...valid, formatVersion: undefined })],
    ['une version du futur', JSON.stringify({ ...valid, formatVersion: 999 })],
    ['une date illisible', JSON.stringify({ ...valid, exportedAt: 'hier' })],
    ['des données manquantes', JSON.stringify({ ...valid, data: null })],
    ['un tiroir qui n’est pas une liste', JSON.stringify({ ...valid, data: { exercises: {} } })],
    ['une ligne qui n’est pas un objet', JSON.stringify({ ...valid, data: { exercises: [42] } })],
  ])('refuse %s', (_label, text) => {
    expect(() => parseBackup(text)).toThrow(AppError);
  });

  it('accepte un fichier valide', () => {
    expect(parseBackup(JSON.stringify(valid)).formatVersion).toBe(1);
  });

  it('un fichier incohérent ne modifie rien : les données en place sont intactes', async () => {
    const database = await freshDb();
    await fillSampleData(database);
    const before = await dumpOf(database);
    const good = await exportBackup('0.1.0', database);

    // Ligne sans identifiant.
    const noId = structuredClone(good);
    delete (noId.data.sets[0] as { id?: string }).id;
    await expect(importBackup(throughFile(noId), database)).rejects.toThrow(AppError);
    expect(await dumpOf(database)).toEqual(before);

    // Deux lignes avec le même identifiant : l'échec survient en cours d'écriture.
    const duplicated = structuredClone(good);
    duplicated.data.sets.push(duplicated.data.sets[0]);
    await expect(importBackup(throughFile(duplicated), database)).rejects.toThrow(AppError);
    expect(await dumpOf(database)).toEqual(before);

    // Deux pesées le même jour : interdit par la base.
    const sameDay = structuredClone(good);
    sameDay.data.bodyweights.push({ id: 'bw-x', date: '2026-10-01', weightKg: 1, createdAt: 1, updatedAt: 1 });
    await expect(importBackup(throughFile(sameDay), database)).rejects.toThrow(AppError);
    expect(await dumpOf(database)).toEqual(before);
    database.close();
  });
});

describe('résumés', () => {
  it('compte les mêmes choses dans la base et dans un fichier', async () => {
    const database = await freshDb();
    await fillSampleData(database);
    const expected = {
      sessions: 1, // la séance en cours ne compte pas
      programs: 1,
      exercises: BUILTIN_EXERCISES.length + 1,
      customExercises: 1,
      bodyweights: 2,
    };
    expect(await getDataCounts(database)).toEqual(expected);
    expect(countsFromDump((await exportBackup('0.1.0', database)).data)).toEqual(expected);
    database.close();
  });

  it('une appli tout juste installée n’a rien à sauvegarder', async () => {
    const database = await freshDb();
    expect(hasUserData(await getDataCounts(database))).toBe(false);
    await fillSampleData(database);
    expect(hasUserData(await getDataCounts(database))).toBe(true);
    database.close();
  });
});

describe('rappel de sauvegarde', () => {
  const now = Date.UTC(2026, 10, 15);
  const base = { now, lastBackupAt: null, firstLaunchAt: null, snoozedUntil: null, hasUserData: true };
  const daysAgo = (days: number) => now - days * DAY_MS;

  it('se déclenche après 14 jours sans sauvegarde', () => {
    expect(BACKUP_REMINDER_DAYS).toBe(14);
    expect(isBackupDue({ ...base, lastBackupAt: daysAgo(15) })).toBe(true);
    expect(isBackupDue({ ...base, lastBackupAt: daysAgo(14) })).toBe(false);
    expect(isBackupDue({ ...base, lastBackupAt: daysAgo(1) })).toBe(false);
  });

  it('sans aucune sauvegarde, compte à partir du premier lancement', () => {
    expect(isBackupDue({ ...base, firstLaunchAt: daysAgo(20) })).toBe(true);
    expect(isBackupDue({ ...base, firstLaunchAt: daysAgo(3) })).toBe(false);
  });

  it('ne dérange pas s’il n’y a rien à sauvegarder', () => {
    expect(isBackupDue({ ...base, lastBackupAt: daysAgo(100), hasUserData: false })).toBe(false);
  });

  it('respecte « Plus tard »', () => {
    const late = { ...base, lastBackupAt: daysAgo(30) };
    expect(isBackupDue({ ...late, snoozedUntil: now + DAY_MS })).toBe(false);
    expect(isBackupDue({ ...late, snoozedUntil: now - DAY_MS })).toBe(true);
  });
});

describe('export CSV de l’historique', () => {
  it('une ligne par série validée des séances terminées', async () => {
    const database = await freshDb();
    await fillSampleData(database);
    const csv = await buildHistoryCsv(database);

    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toEqual([
      'Date;Heure;Programme;Séance;Exercice;Série;Type;Charge (kg);Répétitions;RPE;Note exercice;Note séance',
      '2026-10-01;18:30;Upper / Lower;Upper A;Développé couché (barre);1;Échauffement;40;10;;"Prise ""large""";"Bonne séance ; en forme"',
      '2026-10-01;18:30;Upper / Lower;Upper A;Développé couché (barre);2;Normale;82,5;8;8,5;"Prise ""large""";"Bonne séance ; en forme"',
      '2026-10-01;18:30;Upper / Lower;Upper A;Développé couché (barre);3;Échec;80;7;;"Prise ""large""";"Bonne séance ; en forme"',
    ]);
    database.close();
  });

  it('sans séance, seulement la ligne de titres', async () => {
    const database = await freshDb();
    const csv = await buildHistoryCsv(database);
    expect(csv.slice(1).trimEnd().split('\r\n')).toHaveLength(1);
    database.close();
  });
});

describe('nom du fichier', () => {
  it('contient la date et l’heure, pour ne pas écraser la sauvegarde précédente', () => {
    expect(backupFileName(new Date(2026, 10, 5, 9, 7).getTime())).toBe(
      'suivi-muscu-2026-11-05-0907.json',
    );
  });
});
