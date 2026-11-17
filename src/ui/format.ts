import {
  DAY_MS,
  AppError,
  localDate,
  type DataCounts,
  type GoalStatus,
  type Lift,
  type PersonalGoal,
  type PlannedExercise,
  type RecapPeriod,
  type SetEntry,
} from '../data';

const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

/** Jour 'AAAA-MM-JJ' → « 12 nov. » */
export const formatShortDate = (date: string) => shortDay.format(new Date(`${date}T12:00:00`));

const weekDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const weekDayYear = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const monthYear = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

/** Jour 'AAAA-MM-JJ' → « dim. 15 nov. » (avec l'année si ce n'est pas l'année en cours). */
export function formatDay(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return (d.getFullYear() === new Date().getFullYear() ? weekDay : weekDayYear).format(d);
}

/** « novembre 2026 » */
export const formatMonth = (year: number, monthIndex: number) =>
  monthYear.format(new Date(year, monthIndex, 1, 12));

/** Chronomètre : « 4:07 », « 1:02:15 ». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = String(s % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** Durée d'une séance : « 52 min », « 1 h 05 ». */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Volume : « 4 250 kg ». */
export const formatVolume = (kg: number) => `${Math.round(kg).toLocaleString('fr-FR')} kg`;

/** Charge d'une série : « 82,5 kg », ou « poids du corps » pour 0 kg. */
export const formatLoad = (weight: number) => (weight === 0 ? 'poids du corps' : formatKg(weight));

/** Une série : « 82,5 kg × 8 ». */
export function formatSet(set: Pick<SetEntry, 'weight' | 'reps'>): string {
  const weight = set.weight === null ? '— kg' : formatLoad(set.weight);
  return `${weight} × ${set.reps ?? '—'}`;
}

/** Plusieurs séries, regroupées par charge : « 80 kg × 8, 8, 7 · 60 kg × 12 ». */
export function formatLifts(lifts: Lift[]): string {
  const groups: { weight: number; reps: number[] }[] = [];
  for (const lift of lifts) {
    const last = groups[groups.length - 1];
    if (last && last.weight === lift.weight) last.reps.push(lift.reps);
    else groups.push({ weight: lift.weight, reps: [lift.reps] });
  }
  return groups.map((g) => `${formatLoad(g.weight)} × ${g.reps.join(', ')}`).join(' · ');
}

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

const monthOnly = new Intl.DateTimeFormat('fr-FR', { month: 'long' });

/** « novembre » */
export const formatMonthName = (year: number, monthIndex: number) => monthOnly.format(new Date(year, monthIndex, 1, 12));

/** Titre d'un bilan : « Novembre 2026 » ou « Année 2026 ». */
export function formatRecapTitle(period: RecapPeriod): string {
  if (period.kind === 'year') return `Année ${period.year}`;
  const text = formatMonth(period.year, period.month! - 1);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** « d’octobre », « de novembre » : l'élision devant une voyelle. */
export function formatOfMonth(period: RecapPeriod): string {
  const name = formatMonthName(period.year, period.month! - 1);
  return /^[aeiouyh]/.test(name) ? `d’${name}` : `de ${name}`;
}

/** Ce que vise un objectif : « 100 kg × 5 », « 15 rép. », « 75 kg », « 50 séances ». */
export function formatGoalTarget(goal: PersonalGoal): string {
  if (goal.kind === 'lift') {
    if (goal.target === 0) return `${goal.reps} rép.`;
    return goal.reps > 1 ? `${formatKg(goal.target)} × ${goal.reps}` : formatKg(goal.target);
  }
  if (goal.kind === 'bodyweight') return formatKg(goal.target);
  return plural(goal.target, 'séance');
}

/** Une valeur suivie par un objectif, dans son unité. */
export function formatGoalValue(status: Pick<GoalStatus, 'unit'>, value: number): string {
  if (status.unit === 'kg') return formatKg(value);
  if (status.unit === 'reps') return `${value} rép.`;
  return plural(value, 'séance');
}

/** Temps restant avant la date limite : « dans 12 jours », « aujourd’hui », « dépassée ». */
export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft < 0) return 'date dépassée';
  if (daysLeft === 0) return 'aujourd’hui';
  if (daysLeft === 1) return 'demain';
  return `dans ${daysLeft} jours`;
}

const weekdayLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });

/** Jour proche dit simplement : « aujourd’hui », « demain », « jeudi », sinon « le 20 nov. ». */
export function formatNearDay(date: string, today: string): string {
  const days = Math.round(
    (new Date(`${date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / DAY_MS,
  );
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  if (days > 1 && days < 7) return weekdayLong.format(new Date(`${date}T12:00:00`));
  return `le ${formatShortDate(date)}`;
}

/** Message à montrer à l'utilisateur pour une erreur quelconque. */
export function messageOf(error: unknown): string {
  if (error instanceof AppError) return error.message;
  console.error(error);
  return 'Une erreur inattendue est survenue. Tes données n’ont pas été modifiées.';
}
