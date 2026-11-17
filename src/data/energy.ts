import type { Muscle } from './types';

// Dépense d'énergie et besoins : calculs purs (aucun accès à la base).
// Ce sont des estimations : aucune appli ne mesure exactement les calories, les montres non plus.

export type Sex = 'male' | 'female';
/** Activité en dehors de la salle et de la marche : le travail, surtout. */
export type JobActivity = 'sitting' | 'standing' | 'physical';
export type NutritionGoal = 'cut' | 'maintain' | 'bulk';

export interface Profile {
  sex: Sex | null;
  /** 'AAAA-MM-JJ'. */
  birthDate: string | null;
  heightCm: number | null;
  job: JobActivity;
  /** Pas par jour en moyenne : la valeur de chaque jour, sauf si on note les pas du jour. */
  stepsPerDay: number;
}

export const DEFAULT_PROFILE: Profile = { sex: null, birthDate: null, heightCm: null, job: 'sitting', stepsPerDay: 6000 };

export const PROFILE_LIMITS = {
  height: { min: 120, max: 230 },
  steps: { min: 0, max: 60000 },
} as const;

export const SEX_LABELS: Record<Sex, string> = { male: 'Homme', female: 'Femme' };
export const JOB_LABELS: Record<JobActivity, string> = { sitting: 'Assis', standing: 'Debout', physical: 'Physique' };
export const NUTRITION_GOAL_LABELS: Record<NutritionGoal, string> = {
  cut: 'Sèche',
  maintain: 'Maintien',
  bulk: 'Prise de masse',
};

const isDay = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

export function normalizeProfile(raw: unknown): Profile {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const height = Number(r.heightCm);
  const steps = Number(r.stepsPerDay);
  return {
    sex: r.sex === 'male' || r.sex === 'female' ? r.sex : null,
    birthDate: isDay(r.birthDate) ? r.birthDate : null,
    heightCm:
      r.heightCm !== null && Number.isFinite(height) && height >= PROFILE_LIMITS.height.min && height <= PROFILE_LIMITS.height.max
        ? Math.round(height)
        : null,
    job: r.job === 'standing' || r.job === 'physical' ? r.job : 'sitting',
    stepsPerDay:
      Number.isFinite(steps) && steps >= PROFILE_LIMITS.steps.min && steps <= PROFILE_LIMITS.steps.max
        ? Math.round(steps)
        : DEFAULT_PROFILE.stepsPerDay,
  };
}

/** Âge en années révolues à une date. */
export function ageOn(birthDate: string, day: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = day.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Métabolisme de base (formule de Mifflin-St Jeor), en kcal par jour. */
export function basalMetabolism(input: { sex: Sex; age: number; heightCm: number; weightKg: number }): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return Math.round(base + (input.sex === 'male' ? 5 : -161));
}

/** Vie quotidienne hors marche et hors séances, en part du métabolisme de base. */
export const JOB_FACTOR: Record<JobActivity, number> = { sitting: 0.1, standing: 0.25, physical: 0.45 };

/** Calories de la marche : environ 0,0005 kcal par pas et par kg de poids de corps. */
export function stepsKcal(steps: number, weightKg: number): number {
  return Math.round(Math.max(0, steps) * weightKg * 0.0005);
}

/** Poids d'un muscle dans la dépense : les grands groupes dépensent plus que les petits. */
export const MUSCLE_FACTOR: Record<Muscle, number> = {
  quadriceps: 1.5,
  ischios: 1.5,
  fessiers: 1.5,
  dos: 1.5,
  lombaires: 1.3,
  pectoraux: 1.1,
  epaules: 1,
  trapezes: 1,
  adducteurs: 1,
  abducteurs: 1,
  biceps: 0.7,
  triceps: 0.7,
  'avant-bras': 0.6,
  mollets: 0.7,
  abdominaux: 0.7,
};

export interface WorkoutInput {
  sessionId: string;
  name: string;
  durationSec: number;
  /** Séries qui comptent, par exercice. */
  exercises: { exerciseId: string; name: string; primaryMuscle: Muscle; sets: number }[];
}

export interface WorkoutEnergy {
  sessionId: string;
  name: string;
  kcal: number;
  exercises: { exerciseId: string; name: string; kcal: number }[];
}

/**
 * Calories d'une séance, en plus du métabolisme de base (déjà compté).
 * Intensité (MET) d'après les muscles travaillés : de 3,5 (petits muscles) à 5 (jambes, dos),
 * multipliée par le poids et la durée. Chaque exercice reçoit sa part selon ses séries et ses muscles.
 */
export function workoutKcal(input: WorkoutInput, weightKg: number): WorkoutEnergy {
  const sets = input.exercises.reduce((sum, e) => sum + e.sets, 0);
  const weighted = input.exercises.reduce((sum, e) => sum + e.sets * MUSCLE_FACTOR[e.primaryMuscle], 0);
  if (sets === 0) return { sessionId: input.sessionId, name: input.name, kcal: 0, exercises: [] };
  // Durée inconnue ou incohérente : environ 2 min 30 par série, repos compris.
  const minutes = input.durationSec >= 60 ? Math.min(180, input.durationSec / 60) : sets * 2.5;
  const met = 2.5 + 1.7 * (weighted / sets);
  const kcal = Math.round((met - 1) * weightKg * (minutes / 60));
  return {
    sessionId: input.sessionId,
    name: input.name,
    kcal,
    exercises: input.exercises
      .filter((e) => e.sets > 0)
      .map((e) => ({
        exerciseId: e.exerciseId,
        name: e.name,
        kcal: Math.round((kcal * e.sets * MUSCLE_FACTOR[e.primaryMuscle]) / weighted),
      })),
  };
}

export interface DayEnergy {
  bmr: number;
  /** Vie quotidienne (travail, tâches) hors marche. */
  daily: number;
  steps: number;
  stepsKcal: number;
  workouts: WorkoutEnergy[];
  workoutKcal: number;
  /** Digestion : environ 10 % de la dépense. */
  digestion: number;
  total: number;
}

export function dayEnergy(input: {
  bmr: number;
  job: JobActivity;
  steps: number;
  weightKg: number;
  workouts: WorkoutEnergy[];
}): DayEnergy {
  const daily = Math.round(input.bmr * JOB_FACTOR[input.job]);
  const walk = stepsKcal(input.steps, input.weightKg);
  const training = input.workouts.reduce((sum, w) => sum + w.kcal, 0);
  const digestion = Math.round(0.1 * (input.bmr + daily + walk + training));
  return {
    bmr: input.bmr,
    daily,
    steps: input.steps,
    stepsKcal: walk,
    workouts: input.workouts,
    workoutKcal: training,
    digestion,
    total: input.bmr + daily + walk + training + digestion,
  };
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Calories à viser selon l'objectif. */
export const GOAL_FACTOR: Record<NutritionGoal, number> = { cut: 0.8, maintain: 1, bulk: 1.1 };

/** Ce qu'il faut manger dans la journée : calories, puis protéines, lipides, et glucides pour le reste. */
export function nutritionTargets(total: number, weightKg: number, goal: NutritionGoal): Macros {
  const kcal = Math.round((total * GOAL_FACTOR[goal]) / 10) * 10;
  const protein = Math.round(weightKg * (goal === 'cut' ? 2.2 : 1.8));
  const fat = Math.round(Math.max(weightKg * 0.8, (kcal * 0.25) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

/**
 * Évolution du poids, en % par semaine, sur les 4 dernières semaines (droite qui passe au mieux
 * entre les pesées). Il faut au moins 3 pesées sur au moins 7 jours.
 */
export function weightTrend(weighIns: { date: string; weightKg: number }[], today: string): number | null {
  const toDays = (day: string) => Math.round(new Date(`${day}T12:00:00`).getTime() / 86_400_000);
  const end = toDays(today);
  const points = weighIns
    .filter((w) => Number.isFinite(w.weightKg) && toDays(w.date) <= end && toDays(w.date) > end - 28)
    .map((w) => ({ x: toDays(w.date), y: w.weightKg }));
  if (points.length < 3) return null;
  const xs = points.map((p) => p.x);
  if (Math.max(...xs) - Math.min(...xs) < 7) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / points.length;
  const my = points.reduce((a, p) => a + p.y, 0) / points.length;
  const slope =
    points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return Math.round(((slope * 7) / my) * 1000) / 10;
}

/** Rythme conseillé, en % du poids par semaine. */
export const PACE_RANGE: Record<NutritionGoal, [number, number]> = {
  cut: [-1, -0.4],
  maintain: [-0.3, 0.3],
  bulk: [0.15, 0.5],
};

export interface PaceAdvice {
  /** good : bon rythme ; more / less : manger un peu plus ou un peu moins ; unknown : pas assez de pesées. */
  status: 'good' | 'more' | 'less' | 'unknown';
  /** Ajustement conseillé, en kcal par jour (+150, −150 ou 0). */
  adjust: number;
}

export function paceAdvice(goal: NutritionGoal, trend: number | null): PaceAdvice {
  if (trend === null) return { status: 'unknown', adjust: 0 };
  const [min, max] = PACE_RANGE[goal];
  if (trend < min) return { status: 'more', adjust: 150 };
  if (trend > max) return { status: 'less', adjust: -150 };
  return { status: 'good', adjust: 0 };
}

/** Les points clés de chaque objectif. */
export const GOAL_TIPS: Record<NutritionGoal, string[]> = {
  cut: [
    'Un déficit modéré (environ 20 %) : tu perds du gras sans fondre tes muscles.',
    'Beaucoup de protéines, à chaque repas : elles protègent tes muscles et calent.',
    'Garde des charges lourdes à la salle : c’est le signal qui garde tes muscles.',
    'Marche davantage : les pas creusent le déficit sans fatiguer tes séances.',
  ],
  maintain: [
    'Mange autour de ta dépense : ton poids reste stable à ± 0,3 % par semaine.',
    'Assez de protéines (environ 1,8 g par kg) pour continuer à progresser.',
    'Pèse-toi 2 à 3 fois par semaine, le matin : seule la tendance compte.',
  ],
  bulk: [
    'Un léger surplus (environ 10 %) : tu prends du muscle en limitant le gras.',
    'Vise + 0,25 à + 0,5 % du poids par semaine, pas plus.',
    'Augmente les charges régulièrement : le surplus ne sert que si tu progresses.',
    'Les glucides autour de la séance aident à t’entraîner fort.',
  ],
};
