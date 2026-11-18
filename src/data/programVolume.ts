import { GOALS, MAJOR_MUSCLES } from './coach';
import type { Goal } from './settings';
import type { Exercise, ID, Muscle, PlannedExercise, Program, ProgramWorkout } from './types';

// Volume prévu par un programme : séries par groupe musculaire et par semaine, pour le construire
// d'un coup d'œil. Même règle que l'onglet Conseils : muscle principal = 1 série, secondaire = ½.

export interface PlannedMuscle {
  muscle: Muscle;
  /** Séries par semaine (ou dans la séance), arrondies à ½. */
  sets: number;
  status: 'low' | 'ok' | 'high';
}

const half = (value: number) => Math.round(value * 2) / 2;

/** Séries prévues par muscle dans une séance (muscle principal 1, secondaire ½). */
export function workoutMuscleSets(items: PlannedExercise[], exercises: Map<ID, Exercise>): Map<Muscle, number> {
  const sets = new Map<Muscle, number>();
  for (const item of items) {
    const exercise = exercises.get(item.exerciseId);
    if (!exercise) continue;
    sets.set(exercise.primaryMuscle, (sets.get(exercise.primaryMuscle) ?? 0) + item.sets);
    for (const muscle of exercise.secondaryMuscles) sets.set(muscle, (sets.get(muscle) ?? 0) + item.sets / 2);
  }
  return sets;
}

/**
 * Nombre de fois où chaque séance revient dans la semaine.
 * Jours fixes : le nombre de jours où elle est placée. Rotation : les séances par semaine
 * se répartissent sur le cycle.
 */
export function weeklyFrequency(program: Program, workouts: ProgramWorkout[], rotationPerWeek: number): Map<ID, number> {
  const times = new Map<ID, number>();
  if (program.scheduleMode === 'fixedDays') {
    for (const id of Object.values(program.fixedDays)) if (id) times.set(id, (times.get(id) ?? 0) + 1);
  } else if (workouts.length > 0) {
    for (const workout of workouts) times.set(workout.id, rotationPerWeek / workouts.length);
  }
  return times;
}

/** Séries par semaine pour chaque grand groupe musculaire (et les autres travaillés), comparées à l'objectif. */
export function programVolume(input: {
  program: Program;
  workouts: ProgramWorkout[];
  exercises: Map<ID, Exercise>;
  goal: Goal;
  rotationPerWeek: number;
}): { muscles: PlannedMuscle[]; target: [number, number] } {
  const target = GOALS[input.goal].weeklySets;
  const times = weeklyFrequency(input.program, input.workouts, input.rotationPerWeek);
  const totals = new Map<Muscle, number>(MAJOR_MUSCLES.map((m) => [m, 0]));
  for (const workout of input.workouts) {
    const factor = times.get(workout.id) ?? 0;
    if (factor === 0) continue;
    for (const [muscle, sets] of workoutMuscleSets(workout.items, input.exercises)) {
      totals.set(muscle, (totals.get(muscle) ?? 0) + sets * factor);
    }
  }
  const muscles = [...totals.entries()]
    // Les petits groupes hors liste n'apparaissent que s'ils sont travaillés.
    .filter(([muscle, sets]) => MAJOR_MUSCLES.includes(muscle) || sets > 0)
    .map(([muscle, sets]) => {
      const rounded = half(sets);
      return {
        muscle,
        sets: rounded,
        status: (rounded < target[0] ? 'low' : rounded > target[1] ? 'high' : 'ok') as PlannedMuscle['status'],
      };
    });
  return { muscles, target };
}
