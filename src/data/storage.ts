/** Protection du stockage : empêche le téléphone d'effacer les données quand il manque de place. */
export type PersistState = 'persisted' | 'not-persisted' | 'unsupported';

export interface StorageInfo {
  state: PersistState;
  /** Espace utilisé par l'appli, en octets (null si le téléphone ne le dit pas). */
  usage: number | null;
}

/** Demande la protection si elle n'est pas déjà accordée. Sans effet si elle l'est. */
export async function requestPersistence(): Promise<PersistState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported';
  try {
    if (await navigator.storage.persisted()) return 'persisted';
    return (await navigator.storage.persist()) ? 'persisted' : 'not-persisted';
  } catch {
    return 'unsupported';
  }
}

export async function getStorageInfo(): Promise<StorageInfo> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return { state: 'unsupported', usage: null };
  }
  try {
    const persisted = await navigator.storage.persisted();
    const estimate = navigator.storage.estimate ? await navigator.storage.estimate() : null;
    return {
      state: persisted ? 'persisted' : 'not-persisted',
      usage: estimate?.usage ?? null,
    };
  } catch {
    return { state: 'unsupported', usage: null };
  }
}
