import { useMemo } from 'react';
import {
  MUSCLE_LABELS,
  listExercises,
  programVolume,
  setSetting,
  useLive,
  useSettings,
  workoutMuscleSets,
  type Exercise,
  type ID,
  type Muscle,
  type PlannedExercise,
  type Program,
  type ProgramWorkout,
} from '../data';
import { formatNumber } from '../ui/format';
import { IconMinus, IconPlus } from '../ui/icons';

/** Exercices de la bibliothèque (masqués compris), par identifiant. */
export function useExerciseMap(): Map<ID, Exercise> {
  const exercises = useLive(() => listExercises({ includeArchived: true }), []);
  return useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);
}

const BAR = { low: 'bg-gold', ok: 'bg-ink/85', high: 'bg-accent-bright' } as const;
const VALUE = { low: 'text-gold', ok: 'text-ink', high: 'text-accent' } as const;

/**
 * Séries par semaine et par groupe musculaire que donne le programme, comparées à la zone conseillée
 * pour l'objectif (onglet Conseils). Les muscles de la séance ouverte sont mis en avant.
 */
export function ProgramVolumeCard({
  program,
  workouts,
  highlight,
}: {
  program: Program;
  workouts: ProgramWorkout[];
  highlight?: Set<Muscle>;
}) {
  const settings = useSettings();
  const exercises = useExerciseMap();
  if (!settings) return null;
  const perWeek = settings.rotationPerWeek;
  const { muscles, target } = programVolume({
    program,
    workouts,
    exercises,
    goal: settings.goal,
    rotationPerWeek: perWeek,
  });
  const [min, max] = target;
  const scale = Math.max(max * 1.3, ...muscles.map((m) => m.sets));
  const pct = (value: number) => `${(value / scale) * 100}%`;
  const round = 'flex size-9 items-center justify-center rounded-full border border-line bg-raised active:bg-line disabled:opacity-35';

  return (
    <div className="space-y-3 rounded-3xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted">
          Zone conseillée <span className="font-semibold text-ink">{min}–{max}</span> séries
        </p>
        {program.scheduleMode === 'rotation' && (
          <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Séances par semaine">
            <button
              type="button"
              className={round}
              aria-label="Une séance de moins par semaine"
              disabled={perWeek <= 1}
              onClick={() => void setSetting('rotationPerWeek', perWeek - 1)}
            >
              <IconMinus className="size-4" />
            </button>
            <span className="min-w-14 text-center text-sm font-semibold tabular-nums">{perWeek} / sem.</span>
            <button
              type="button"
              className={round}
              aria-label="Une séance de plus par semaine"
              disabled={perWeek >= 14}
              onClick={() => void setSetting('rotationPerWeek', perWeek + 1)}
            >
              <IconPlus className="size-4" />
            </button>
          </div>
        )}
      </div>
      <ul className="space-y-2">
        {muscles.map(({ muscle, sets, status }) => {
          const strong = highlight?.has(muscle);
          return (
            <li key={muscle} className="flex items-center gap-3">
              <span className={`w-24 shrink-0 truncate text-sm ${strong ? 'font-bold text-ink' : highlight ? 'text-muted' : ''}`}>
                {MUSCLE_LABELS[muscle]}
              </span>
              <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8">
                <span className="absolute inset-y-0 rounded-full bg-white/14" style={{ left: pct(min), width: pct(max - min) }} />
                <span className={`absolute inset-y-0 left-0 rounded-full ${BAR[status]}`} style={{ width: pct(sets) }} />
              </span>
              <span className={`w-8 shrink-0 text-right text-sm font-bold tabular-nums ${VALUE[status]}`}>
                {formatNumber(sets)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Muscles d'une séance, du plus travaillé au moins travaillé : « Pectoraux 4 », « Triceps 2 »… */
export function workoutMuscles(items: PlannedExercise[], exercises: Map<ID, Exercise>): { muscle: Muscle; sets: number }[] {
  return [...workoutMuscleSets(items, exercises).entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

/** Pastilles des muscles travaillés par une séance. */
export function MuscleChips({ items, exercises }: { items: PlannedExercise[]; exercises: Map<ID, Exercise> }) {
  const muscles = workoutMuscles(items, exercises);
  if (muscles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {muscles.map(({ muscle, sets }) => (
        <span key={muscle} className="rounded-full border border-line bg-surface px-2.5 py-1 text-sm">
          {MUSCLE_LABELS[muscle]} <span className="font-bold tabular-nums">{formatNumber(sets)}</span>
        </span>
      ))}
    </div>
  );
}
