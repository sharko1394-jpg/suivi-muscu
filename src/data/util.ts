/** Erreur dont le message (en français) peut être montré tel quel à l'utilisateur. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

/** Identifiant unique, généré sur le téléphone (compatible avec une future synchro). */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Secours pour les contextes non sécurisés (http sur réseau local).
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}

/** Texte sans accents ni majuscules, pour chercher et comparer des noms. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jour local au format 'AAAA-MM-JJ'. */
export function localDate(timestamp: number): string {
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
