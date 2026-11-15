// Signal sonore de fin de repos, fabriqué par l'appli : aucun fichier son à télécharger.

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;
let scheduled: { oscillator: OscillatorNode; gain: GainNode }[] = [];

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

/**
 * À appeler pendant un appui de l'utilisateur.
 * Les navigateurs (l'iPhone surtout) n'autorisent le son qu'à la suite d'un geste.
 */
export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
}

export function cancelBeep(): void {
  for (const { oscillator, gain } of scheduled) {
    try {
      oscillator.stop();
    } catch {
      // déjà arrêté
    }
    oscillator.disconnect();
    gain.disconnect();
  }
  scheduled = [];
}

/**
 * Programme trois bips dans `delaySec` secondes (remplace ceux déjà programmés).
 * Programmés à l'avance sur l'horloge audio, ils sonnent à l'heure même si l'écran est occupé.
 * Sans effet tant que le son n'a pas été autorisé par un appui.
 */
export function scheduleBeep(delaySec: number): void {
  cancelBeep();
  const ctx = context;
  if (!ctx || ctx.state !== 'running') return;
  const start = ctx.currentTime + Math.max(0, delaySec);
  for (let i = 0; i < 3; i++) {
    const at = start + i * 0.3;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = i === 2 ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.6, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + (i === 2 ? 0.45 : 0.22));
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + (i === 2 ? 0.5 : 0.25));
    scheduled.push({ oscillator, gain });
  }
}
