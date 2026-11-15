import { useEffect, useState } from 'react';
import type { RestTimer } from '../data';
import { cancelBeep, scheduleBeep, unlockAudio } from './sound';

/** Heure courante, rafraîchie régulièrement et à chaque retour au premier plan. */
export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs]);
  return now;
}

/**
 * Garde l'écran allumé tant que `active` est vrai (si le téléphone le permet).
 * Le téléphone relâche ce verrou dès que l'appli passe en arrière-plan : on le reprend au retour.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (stopped) void lock.release().catch(() => {});
        else sentinel = lock;
      } catch {
        // refusé (batterie faible, par exemple) : l'écran s'éteindra normalement
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}

/** Fait sonner et vibrer le téléphone à la fin du repos. */
export function useRestAlarm(timer: RestTimer | null, sound: boolean, vibration: boolean): void {
  const endsAt = timer?.endsAt ?? null;

  useEffect(() => {
    if (endsAt === null || !sound) return;
    const schedule = () => {
      const delaySec = (endsAt - Date.now()) / 1000;
      if (delaySec > 0) scheduleBeep(delaySec);
    };
    schedule();
    // Appli rouverte en plein repos : le son n'est autorisé qu'après un premier appui.
    const onTap = () => {
      unlockAudio();
      setTimeout(schedule, 80);
    };
    window.addEventListener('pointerdown', onTap, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onTap);
      cancelBeep();
    };
  }, [endsAt, sound]);

  useEffect(() => {
    if (endsAt === null || !vibration || !('vibrate' in navigator)) return;
    const delay = endsAt - Date.now();
    if (delay <= 0) return;
    const id = setTimeout(() => navigator.vibrate([250, 120, 250, 120, 400]), delay);
    return () => clearTimeout(id);
  }, [endsAt, vibration]);
}
