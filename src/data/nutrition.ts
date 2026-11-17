import { isCountedSet } from './calc';
import { db, type AppDB } from './db';
import {
  ageOn,
  basalMetabolism,
  dayEnergy,
  normalizeProfile,
  nutritionTargets,
  paceAdvice,
  weightTrend,
  workoutKcal,
  type DayEnergy,
  type Macros,
  type NutritionGoal,
  type PaceAdvice,
  type Profile,
  type WorkoutInput,
} from './energy';
import { getSettings, setSetting } from './settings';
import type { ID, Muscle } from './types';
import { AppError, localDate, newId } from './util';

// Nutrition : ce qui est mangé chaque jour, les pas du jour, et le bilan dépense / besoins.
// Chaque jour est une ligne `nutrition:AAAA-MM-JJ` du tiroir `settings` : la forme de la base
// ne change pas (toujours la version 1), et tout part dans les sauvegardes.

export const NUTRITION_KEY_PREFIX = 'nutrition:';
const keyOf = (date: string) => `${NUTRITION_KEY_PREFIX}${date}`;

export interface FoodEntry {
  id: string;
  name: string;
  /** Quantité en g, si l'aliment vient de la liste. */
  grams: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  at: number;
}

export interface NutritionDay {
  date: string;
  /** Pas notés ce jour-là ; null = la moyenne du profil. */
  steps: number | null;
  foods: FoodEntry[];
}

export const FOOD_LIMITS = { kcal: 5000, macro: 500, name: 60 } as const;

const num = (value: unknown, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 10) / 10 : 0;
};

export function normalizeNutritionDay(raw: unknown, date: string): NutritionDay {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const steps = Number(r.steps);
  const foods: FoodEntry[] = [];
  if (Array.isArray(r.foods)) {
    for (const item of r.foods) {
      if (typeof item !== 'object' || item === null) continue;
      const f = item as Record<string, unknown>;
      if (typeof f.id !== 'string' || typeof f.name !== 'string' || f.name.trim() === '') continue;
      const grams = Number(f.grams);
      foods.push({
        id: f.id,
        name: f.name.trim().slice(0, FOOD_LIMITS.name),
        grams: f.grams !== null && Number.isFinite(grams) && grams > 0 ? Math.round(grams) : null,
        kcal: Math.round(num(f.kcal, FOOD_LIMITS.kcal)),
        protein: num(f.protein, FOOD_LIMITS.macro),
        carbs: num(f.carbs, FOOD_LIMITS.macro),
        fat: num(f.fat, FOOD_LIMITS.macro),
        at: typeof f.at === 'number' ? f.at : 0,
      });
    }
  }
  return {
    date,
    steps: r.steps !== null && r.steps !== undefined && Number.isFinite(steps) && steps >= 0 && steps <= 100_000 ? Math.round(steps) : null,
    foods: foods.sort((a, b) => a.at - b.at),
  };
}

export async function getNutritionDay(date: string, database: AppDB = db): Promise<NutritionDay> {
  const row = await database.settings.get(keyOf(date));
  return normalizeNutritionDay(row?.value, date);
}

async function updateDay(date: string, change: (day: NutritionDay) => NutritionDay, database: AppDB): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const next = change(await getNutritionDay(date, database));
    const { date: _date, ...value } = next;
    await database.settings.put({ key: keyOf(date), value, updatedAt: Date.now() });
  });
}

export interface FoodInput {
  name: string;
  grams?: number | null;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export async function addFoodEntry(date: string, input: FoodInput, now: number = Date.now(), database: AppDB = db): Promise<FoodEntry> {
  const name = input.name.trim();
  if (name === '') throw new AppError('Donne un nom à ce que tu as mangé.');
  if (name.length > FOOD_LIMITS.name) throw new AppError(`Nom trop long (${FOOD_LIMITS.name} caractères au plus).`);
  if (!Number.isFinite(input.kcal) || input.kcal < 0 || input.kcal > FOOD_LIMITS.kcal) {
    throw new AppError(`Indique des calories entre 0 et ${FOOD_LIMITS.kcal} kcal.`);
  }
  for (const value of [input.protein, input.carbs, input.fat]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > FOOD_LIMITS.macro)) {
      throw new AppError(`Indique des grammes entre 0 et ${FOOD_LIMITS.macro}.`);
    }
  }
  const entry: FoodEntry = {
    id: newId(),
    name,
    grams: input.grams && input.grams > 0 ? Math.round(input.grams) : null,
    kcal: Math.round(input.kcal),
    protein: Math.round((input.protein ?? 0) * 10) / 10,
    carbs: Math.round((input.carbs ?? 0) * 10) / 10,
    fat: Math.round((input.fat ?? 0) * 10) / 10,
    at: now,
  };
  await updateDay(date, (day) => ({ ...day, foods: [...day.foods, entry] }), database);
  return entry;
}

export async function removeFoodEntry(date: string, id: string, database: AppDB = db): Promise<void> {
  await updateDay(date, (day) => ({ ...day, foods: day.foods.filter((f) => f.id !== id) }), database);
}

/** Pas du jour ; null = revenir à la moyenne du profil. */
export async function setDaySteps(date: string, steps: number | null, database: AppDB = db): Promise<void> {
  if (steps !== null && (!Number.isFinite(steps) || steps < 0 || steps > 100_000)) {
    throw new AppError('Indique un nombre de pas entre 0 et 100 000.');
  }
  await updateDay(date, (day) => ({ ...day, steps: steps === null ? null : Math.round(steps) }), database);
}

/** Ce qui a été mangé ces 30 derniers jours, sans doublon, le plus récent d'abord : pour le reprendre d'un appui. */
export async function listRecentFoods(today: string, database: AppDB = db): Promise<Omit<FoodEntry, 'id' | 'at'>[]> {
  const from = new Date(`${today}T12:00:00`).getTime() - 30 * 86_400_000;
  const rows = await database.settings.where('key').between(keyOf(localDate(from)), keyOf(today), true, true).toArray();
  const foods = rows
    .flatMap((row) => normalizeNutritionDay(row.value, row.key.slice(NUTRITION_KEY_PREFIX.length)).foods)
    .sort((a, b) => b.at - a.at);
  const seen = new Set<string>();
  const recent: Omit<FoodEntry, 'id' | 'at'>[] = [];
  for (const { id: _id, at: _at, ...food } of foods) {
    const signature = `${food.name}|${food.grams ?? ''}|${food.kcal}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    recent.push(food);
    if (recent.length >= 12) break;
  }
  return recent;
}

// ---------- Profil et objectif ----------

/** Modifie le profil. Avec une fonction, le changement part de la valeur enregistrée (appuis rapides sur + ou −). */
export async function saveProfile(
  patch: Partial<Profile> | ((current: Profile) => Partial<Profile>),
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const { profile } = await getSettings(database);
    const change = typeof patch === 'function' ? patch(profile) : patch;
    await setSetting('profile', normalizeProfile({ ...profile, ...change }), database);
  });
}

export async function setNutritionGoal(goal: NutritionGoal, database: AppDB = db): Promise<void> {
  await setSetting('nutritionGoal', goal, database);
}

// ---------- Bilan du jour ----------

export interface NutritionReport {
  date: string;
  profile: Profile;
  goal: NutritionGoal;
  /** Ce qu'il manque au profil pour faire les calculs. */
  missing: ('sexe' | 'date de naissance' | 'taille' | 'poids')[];
  weightKg: number | null;
  energy: DayEnergy | null;
  targets: Macros | null;
  eaten: Macros;
  day: NutritionDay;
  /** Évolution du poids, en % par semaine (null : pas assez de pesées). */
  trend: number | null;
  advice: PaceAdvice;
}

export async function getNutritionReport(date: string, now: number = Date.now(), database: AppDB = db): Promise<NutritionReport> {
  const [settings, day, weighIns, sessions] = await Promise.all([
    getSettings(database),
    getNutritionDay(date, database),
    database.bodyweights.toArray(),
    database.sessions.where('date').equals(date).toArray(),
  ]);
  const { profile, nutritionGoal: goal } = settings;
  const valid = weighIns.filter((w) => Number.isFinite(w.weightKg)).sort((a, b) => a.date.localeCompare(b.date));
  const weightKg = [...valid].reverse().find((w) => w.date <= date)?.weightKg ?? valid[0]?.weightKg ?? null;

  const missing: NutritionReport['missing'] = [];
  if (!profile.sex) missing.push('sexe');
  if (!profile.birthDate) missing.push('date de naissance');
  if (!profile.heightCm) missing.push('taille');
  if (weightKg === null) missing.push('poids');

  const eaten = day.foods.reduce(
    (sum, f) => ({ kcal: sum.kcal + f.kcal, protein: sum.protein + f.protein, carbs: sum.carbs + f.carbs, fat: sum.fat + f.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const rounded: Macros = {
    kcal: Math.round(eaten.kcal),
    protein: Math.round(eaten.protein),
    carbs: Math.round(eaten.carbs),
    fat: Math.round(eaten.fat),
  };
  const trend = weightTrend(valid, localDate(now) < date ? date : localDate(now));
  const base = { date, profile, goal, missing, weightKg, eaten: rounded, day, trend, advice: paceAdvice(goal, trend) };
  if (missing.length > 0) return { ...base, energy: null, targets: null };

  // Séances terminées ce jour-là : séries qui comptent par exercice.
  const done = sessions.filter((s) => s.status === 'done');
  const ids = done.map((s) => s.id);
  const [exercises, sets] = ids.length
    ? await Promise.all([
        database.sessionExercises.where('sessionId').anyOf(ids).toArray(),
        database.sets.where('sessionId').anyOf(ids).toArray(),
      ])
    : [[], []];
  const workouts: WorkoutInput[] = done
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((session) => {
      const counts = new Map<ID, { exerciseId: ID; name: string; primaryMuscle: Muscle; sets: number }>();
      for (const exercise of exercises.filter((e) => e.sessionId === session.id).sort((a, b) => a.order - b.order)) {
        const n = sets.filter((s) => s.sessionExerciseId === exercise.id && isCountedSet(s)).length;
        const current = counts.get(exercise.exerciseId);
        if (current) current.sets += n;
        else counts.set(exercise.exerciseId, { exerciseId: exercise.exerciseId, name: exercise.exerciseName, primaryMuscle: exercise.primaryMuscle, sets: n });
      }
      return {
        sessionId: session.id,
        name: session.workoutName,
        durationSec: Math.max(0, Math.round(((session.endedAt ?? session.startedAt) - session.startedAt) / 1000)),
        exercises: [...counts.values()],
      };
    });

  const weight = weightKg!;
  const bmr = basalMetabolism({
    sex: profile.sex!,
    age: ageOn(profile.birthDate!, date),
    heightCm: profile.heightCm!,
    weightKg: weight,
  });
  const energy = dayEnergy({
    bmr,
    job: profile.job,
    steps: day.steps ?? profile.stepsPerDay,
    weightKg: weight,
    workouts: workouts.map((w) => workoutKcal(w, weight)),
  });
  return { ...base, energy, targets: nutritionTargets(energy.total, weight, goal) };
}
