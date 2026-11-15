// Couche d'accès aux données.
// Le reste de l'appli n'importe QUE ce fichier (jamais db.ts ni Dexie directement) :
// une synchro cloud pourra s'ajouter plus tard ici sans toucher aux écrans.

import { db } from './db';
import { seedBuiltinExercises } from './exercises';
import { ensureFirstLaunch } from './settings';
import { requestPersistence } from './storage';

export * from './types';
export * from './labels';
export { AppError, normalizeText, localDate, DAY_MS } from './util';
export { CURRENT_VERSION } from './schema';
export * from './exercises';
export * from './settings';
export * from './backup';
export * from './storage';
export * from './hooks';

let ready: Promise<void> | null = null;

/** Ouvre la base (en appliquant les migrations en attente) et prépare les données de base. */
export function initData(): Promise<void> {
  ready ??= (async () => {
    // Si une version plus récente de l'appli ouvre la base dans un autre onglet,
    // on lui laisse la place et on recharge pour utiliser la nouvelle version.
    db.on('versionchange', () => {
      db.close();
      if (typeof window !== 'undefined') window.location.reload();
    });
    await db.open();
    await ensureFirstLaunch();
    await seedBuiltinExercises();
    void requestPersistence();
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}
