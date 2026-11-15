import { DAY_MS, AppError, localDate, type DataCounts } from '../data';

const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** « 15 novembre 2026 à 14:32 » */
export const formatDateTime = (timestamp: number) => dateTime.format(timestamp);

/** « dimanche 15 novembre » */
export const formatLongDay = (timestamp: number) => longDay.format(timestamp);

/** « aujourd’hui », « hier », « il y a 5 jours » */
export function formatAgo(timestamp: number, now: number = Date.now()): string {
  const startOfDay = (t: number) => new Date(`${localDate(t)}T00:00:00`).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS);
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'hier';
  return `il y a ${days} jours`;
}

/** « 1 séance », « 3 séances » (en français, 0 et 1 sont au singulier). */
export function plural(count: number, singular: string, pluralForm: string = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export function describeCounts(counts: DataCounts): string {
  return [
    plural(counts.sessions, 'séance'),
    plural(counts.programs, 'programme'),
    plural(counts.customExercises, 'exercice personnel', 'exercices personnels'),
    plural(counts.bodyweights, 'pesée'),
  ].join(', ');
}

/** Message à montrer à l'utilisateur pour une erreur quelconque. */
export function messageOf(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error(error);
  return 'Une erreur inattendue est survenue. Tes données n’ont pas été modifiées.';
}
