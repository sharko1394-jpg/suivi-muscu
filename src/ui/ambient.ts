// Messages envoyés au fond animé par le reste de l'appli.
// Le fond n'est jamais remonté : il écoute ces messages pour réagir à ce qui se passe.

export type AmbientEvent =
  | { kind: 'record' }
  | { kind: 'rest'; endsAt: number | null };

const EVENT = 'suivi-muscu:ambient';

function send(detail: AmbientEvent): void {
  window.dispatchEvent(new CustomEvent<AmbientEvent>(EVENT, { detail }));
}

/** Un record vient d'être battu : onde de choc dorée dans le fond. */
export const ambientRecord = () => send({ kind: 'record' });

/** Minuteur de repos : le fond ralentit et respire jusqu'à `endsAt` (null = pas de repos). */
export const ambientRest = (endsAt: number | null) => send({ kind: 'rest', endsAt });

export function onAmbient(listener: (event: AmbientEvent) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<AmbientEvent>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
