import { describe, expect, it } from 'vitest';
import { programVolume, weeklyFrequency, workoutMuscleSets } from './programVolume';
import type { Exercise, PlannedExercise, Program, ProgramWorkout } from './types';

const exercise = (id: string, primaryMuscle: Exercise['primaryMuscle'], secondaryMuscles: Exercise['secondaryMuscles']): Exercise => ({
  id,
  name: id,
  primaryMuscle,
  secondaryMuscles,
  equipment: 'barre',
  isCustom: false,
  archived: false,
  weightStep: null,
  createdAt: 0,
  updatedAt: 0,
});
const exercises = new Map([
  ['bench', exercise('bench', 'pectoraux', ['triceps', 'epaules'])],
  ['row', exercise('row', 'dos', ['biceps'])],
  ['squat', exercise('squat', 'quadriceps', ['fessiers'])],
]);
const item = (exerciseId: string, sets: number): PlannedExercise => ({
  id: `${exerciseId}-${sets}`,
  exerciseId,
  sets,
  repMin: 8,
  repMax: 12,
  targetWeight: null,
  restSec: 120,
  note: '',
  supersetGroup: null,
});
const workout = (id: string, items: PlannedExercise[]): ProgramWorkout => ({ id, programId: 'p', name: id, order: 0, items, createdAt: 0, updatedAt: 0 });
const upper = workout('upper', [item('bench', 4), item('row', 4)]);
const lower = workout('lower', [item('squat', 5)]);
const program = (mode: Program['scheduleMode']): Program => ({
  id: 'p',
  name: 'P',
  status: 'active',
  scheduleMode: mode,
  fixedDays: { 1: 'upper', 2: 'lower', 4: 'upper' },
  rotation: ['upper', 'lower'],
  nextRotationIndex: 0,
  createdAt: 0,
  updatedAt: 0,
});

describe('volume prévu par le programme', () => {
  it('séries par muscle dans une séance : principal 1, secondaire ½', () => {
    expect(Object.fromEntries(workoutMuscleSets(upper.items, exercises))).toEqual({
      pectoraux: 4,
      triceps: 2,
      epaules: 2,
      dos: 4,
      biceps: 2,
    });
  });

  it('jours fixes : chaque séance compte autant de fois qu’elle est placée', () => {
    expect(Object.fromEntries(weeklyFrequency(program('fixedDays'), [upper, lower], 3))).toEqual({ upper: 2, lower: 1 });
    const { muscles, target } = programVolume({ program: program('fixedDays'), workouts: [upper, lower], exercises, goal: 'muscle', rotationPerWeek: 3 });
    expect(target).toEqual([10, 20]);
    const get = (m: string) => muscles.find((x) => x.muscle === m);
    expect(get('pectoraux')).toEqual({ muscle: 'pectoraux', sets: 8, status: 'low' });
    expect(get('quadriceps')?.sets).toBe(5);
    // Les grands groupes non travaillés restent visibles, à zéro.
    expect(get('mollets')).toEqual({ muscle: 'mollets', sets: 0, status: 'low' });
  });

  it('rotation : les séances par semaine se répartissent sur le cycle', () => {
    const { muscles } = programVolume({ program: program('rotation'), workouts: [upper, lower], exercises, goal: 'force', rotationPerWeek: 4 });
    // 4 séances par semaine, cycle de 2 : chaque séance 2 fois.
    expect(muscles.find((x) => x.muscle === 'dos')).toEqual({ muscle: 'dos', sets: 8, status: 'ok' });
    expect(muscles.find((x) => x.muscle === 'quadriceps')?.sets).toBe(10);
  });
});
