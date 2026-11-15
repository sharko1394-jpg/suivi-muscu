import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getDataCounts, hasUserData, isBackupDue, type DataCounts } from './backup';
import { getSettings, type Settings } from './settings';
import { getStorageInfo, type StorageInfo } from './storage';

/**
 * Lit des données et se met à jour tout seul dès qu'elles changent.
 * Renvoie undefined pendant le tout premier chargement.
 */
export const useLive = useLiveQuery;

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getSettings(), []);
}

export function useDataCounts(): DataCounts | undefined {
  return useLiveQuery(() => getDataCounts(), []);
}

/** Vrai si la dernière sauvegarde est trop ancienne. */
export function useBackupDue(): boolean {
  const settings = useSettings();
  const counts = useDataCounts();
  if (!settings || !counts) return false;
  return isBackupDue({
    now: Date.now(),
    lastBackupAt: settings.lastBackupAt,
    firstLaunchAt: settings.firstLaunchAt,
    snoozedUntil: settings.backupSnoozedUntil,
    hasUserData: hasUserData(counts),
  });
}

export function useStorageInfo(): [StorageInfo | undefined, () => void] {
  const [info, setInfo] = useState<StorageInfo>();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void getStorageInfo().then((value) => {
      if (!cancelled) setInfo(value);
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);
  return [info, () => setTick((t) => t + 1)];
}
