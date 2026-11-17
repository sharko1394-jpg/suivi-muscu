import { describe, expect, it } from 'vitest';
import {
  ageOn,
  basalMetabolism,
  dayEnergy,
  normalizeProfile,
  nutritionTargets,
  paceAdvice,
  stepsKcal,
  weightTrend,
  workoutKcal,
} from './energy';
import { FOODS, foodFor, searchFoods } from './foods';
import {
  addFoodEntry,
  getNutritionReport,
  listRecentFoods,
  removeFoodEntry,
  saveProfile,
  setDaySteps,
} from './nutrition';
import { saveBodyweight } from './stats';
import { freshDb } from '../test/helpers';

const at = (date: string, hour = 12) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();

describe('dépense d’énergie', () => {
  it('âge et métabolisme de base (Mifflin-St Jeor)', () => {
    expect(ageOn('1996-11-18', '2026-11-17')).toBe(29);
    expect(ageOn('1996-11-17', '2026-11-17')).toBe(30);
    expect(basalMetabolism({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);
    expect(basalMetabolism({ sex: 'female', age: 30, heightCm: 180, weightKg: 80 })).toBe(1614);
  });

  it('pas, séance répartie entre les exercices, et total de la journée', () => {
    expect(stepsKcal(8000, 80)).toBe(320);
    const workout = workoutKcal(
      {
        sessionId: 's1',
        name: 'Jambes',
        durationSec: 3600,
        exercises: [
          { exerciseId: 'squat', name: 'Squat', primaryMuscle: 'quadriceps', sets: 4 },
          { exerciseId: 'curl', name: 'Curl', primaryMuscle: 'biceps', sets: 3 },
        ],
      },
      80,
    );
    expect(workout.kcal).toBe(277);
    // Le squat (grand muscle) prend la plus grosse part.
    expect(workout.exercises).toEqual([
      { exerciseId: 'squat', name: 'Squat', kcal: 205 },
      { exerciseId: 'curl', name: 'Curl', kcal: 72 },
    ]);
    const day = dayEnergy({ bmr: 1780, job: 'sitting', steps: 8000, weightKg: 80, workouts: [workout] });
    expect(day).toMatchObject({ daily: 178, stepsKcal: 320, workoutKcal: 277, digestion: 256, total: 2811 });
  });

  it('besoins selon l’objectif', () => {
    expect(nutritionTargets(2811, 80, 'cut')).toEqual({ kcal: 2250, protein: 176, fat: 64, carbs: 243 });
    expect(nutritionTargets(2811, 80, 'maintain').kcal).toBe(2810);
    expect(nutritionTargets(2811, 80, 'bulk').kcal).toBe(3090);
  });

  it('rythme du poids et conseil', () => {
    const weighIns = [
      { date: '2026-11-03', weightKg: 80 },
      { date: '2026-11-10', weightKg: 79.5 },
      { date: '2026-11-17', weightKg: 79 },
    ];
    expect(weightTrend(weighIns, '2026-11-17')).toBe(-0.6);
    expect(weightTrend(weighIns.slice(0, 2), '2026-11-17')).toBeNull();
    expect(paceAdvice('cut', -0.6)).toEqual({ status: 'good', adjust: 0 });
    expect(paceAdvice('bulk', -0.6)).toEqual({ status: 'more', adjust: 150 });
    expect(paceAdvice('cut', 0)).toEqual({ status: 'less', adjust: -150 });
    expect(paceAdvice('maintain', null).status).toBe('unknown');
  });

  it('profil abîmé : valeurs impossibles écartées', () => {
    expect(normalizeProfile({ sex: 'autre', birthDate: '2026-02-30', heightCm: 400, job: 'nage', stepsPerDay: -5 })).toEqual({
      sex: null,
      birthDate: null,
      heightCm: null,
      job: 'sitting',
      stepsPerDay: 6000,
    });
  });
});

describe('aliments', () => {
  it('recherche sans accents et valeurs pour une quantité', () => {
    expect(searchFoods('oeuf').map((f) => f.name)).toContain('Œuf');
    expect(searchFoods('POULET')[0].name).toBe('Blanc de poulet cuit');
    const rice = FOODS.find((f) => f.name === 'Riz blanc cuit')!;
    expect(foodFor(rice, 200)).toEqual({ kcal: 260, protein: 5.4, carbs: 56, fat: 0.6 });
  });
});

describe('journée de nutrition', () => {
  it('profil incomplet : rien à calculer, ce qui manque est listé', async () => {
    const database = await freshDb();
    const report = await getNutritionReport('2026-11-17', at('2026-11-17'), database);
    expect(report.missing).toEqual(['sexe', 'date de naissance', 'taille', 'poids']);
    expect(report.energy).toBeNull();
    database.close();
  });

  it('repas, pas du jour, dépense et besoins', async () => {
    const database = await freshDb();
    await saveProfile({ sex: 'male', birthDate: '1996-01-15', heightCm: 180, job: 'sitting', stepsPerDay: 8000 }, database);
    await saveBodyweight('2026-11-10', 80, at('2026-11-10'), database);

    let report = await getNutritionReport('2026-11-17', at('2026-11-17'), database);
    expect(report.missing).toEqual([]);
    expect(report.energy).toMatchObject({ bmr: 1780, steps: 8000, stepsKcal: 320, workoutKcal: 0 });
    expect(report.targets?.kcal).toBe(Math.round(report.energy!.total / 10) * 10);

    const entry = await addFoodEntry('2026-11-17', { name: 'Riz blanc cuit', grams: 200, kcal: 260, protein: 5.4, carbs: 56, fat: 0.6 }, at('2026-11-17'), database);
    await addFoodEntry('2026-11-17', { name: 'Shaker', kcal: 120, protein: 24 }, at('2026-11-17', 13), database);
    await setDaySteps('2026-11-17', 12000, database);
    report = await getNutritionReport('2026-11-17', at('2026-11-17'), database);
    expect(report.eaten).toEqual({ kcal: 380, protein: 29, carbs: 56, fat: 1 });
    expect(report.energy?.steps).toBe(12000);

    await removeFoodEntry('2026-11-17', entry.id, database);
    await setDaySteps('2026-11-17', null, database);
    report = await getNutritionReport('2026-11-17', at('2026-11-17'), database);
    expect(report.eaten.kcal).toBe(120);
    expect(report.energy?.steps).toBe(8000);

    expect((await listRecentFoods('2026-11-18', database)).map((f) => f.name)).toEqual(['Shaker']);
    await expect(addFoodEntry('2026-11-17', { name: ' ', kcal: 10 }, at('2026-11-17'), database)).rejects.toThrow('nom');
    database.close();
  });
});
