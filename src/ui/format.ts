import { DAY_MS, AppError, localDate, type DataCounts, type PlannedExercise } from '../data';

/** Nombre à la française : 82.5 → « 82,5 ». */
export function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

export const formatKg = (kg: number) => `${formatNumber(kg)} kg`;

/** Durée de repos : « 45 s », « 2 min », « 2 min 30 ». */
export function formatRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${String(rest).padStart(2, '0')}`;
}

/** Fourchette de répétitions : « 8–12 », ou « 10 » si min = max. */
export const formatReps = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

/** Résumé d'un exercice prévu : « 3 × 8–12 · 80 kg · repos 2 min 30 ». */
export function formatPlanned(
  item: Pick<PlannedExercise, 'sets' | 'repMin' | 'repMax' | 'targetWeight' | 'restSec'>,
): string {
  return [
    `${item.sets} × ${formatReps(item.repMin, item.repMax)}`,
    item.targetWeight === null ? null : formatKg(item.targetWeight),
    item.restSec === 0 ? 'sans repos' : `repos ${formatRest(item.restSec)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

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
