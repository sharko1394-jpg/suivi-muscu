import type { ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import {
  EQUIPMENT_LABELS,
  MOVEMENTS,
  MUSCLE_LABELS,
  exerciseGuide,
  getCoachReport,
  getExercise,
  getGoalStatuses,
  getLibrary,
  useLive,
} from '../data';
import { Button, Card, LinkRow, PageHeader, Section, StatTile } from '../ui/components';
import { ExerciseModel } from '../ui/ExerciseModel';
import { formatAgo, formatGoalTarget, formatKg } from '../ui/format';
import { IconCheck, IconClose, IconTarget, IconTrophy } from '../ui/icons';
import { ForecastCard, LoadCard } from './CoachPage';
import { ExerciseProgress } from './ExerciseProgress';
import type { GoalsPageState } from './GoalsPage';
import { GOALS_PATH, LIBRARY_PATH } from './paths';
import { GoalBar } from './widgets';

function Bullets({ items, icon }: { items: string[]; icon: 'step' | 'tip' | 'avoid' }) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          {icon === 'step' ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
              {index + 1}
            </span>
          ) : icon === 'tip' ? (
            <IconCheck className="mt-0.5 size-6 shrink-0 text-accent" />
          ) : (
            <IconClose className="mt-0.5 size-6 shrink-0 text-gold" />
          )}
          <span className="pt-0.5 leading-snug">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Legend({ color, label, children }: { color: 'hot' | 'soft'; label: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <span
        className={`size-3 shrink-0 rounded-full ${color === 'hot' ? 'bg-accent-bright shadow-[0_0_8px_var(--accent-glow)]' : 'bg-accent-bright/45'}`}
      />
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{children}</span>
    </p>
  );
}

/** Fiche d'un exercice : le mouvement animé, comment le faire, et ce que mon historique en dit. */
export default function ExerciseSheetPage() {
  const navigate = useNavigate();
  const { exerciseId: raw = '' } = useParams();
  const exerciseId = decodeURIComponent(raw);
  const exercise = useLive(async () => (await getExercise(exerciseId)) ?? null, [exerciseId]);
  const entry = useLive(async () => (await getLibrary()).find((e) => e.exercise.id === exerciseId) ?? null, [exerciseId]);
  const coaching = useLive(
    async () => (await getCoachReport()).exercises.find((e) => e.exerciseId === exerciseId) ?? null,
    [exerciseId],
  );
  const goals = useLive(async () => (await getGoalStatuses()).filter((g) => g.goal.exerciseId === exerciseId), [exerciseId]);

  if (exercise === null) return <Navigate to={LIBRARY_PATH} replace />;
  if (exercise === undefined) return <PageHeader title="" backTo={LIBRARY_PATH} />;

  const guide = exerciseGuide(exercise);
  const done = entry !== undefined && entry !== null && entry.sessions > 0;
  const secondary = exercise.secondaryMuscles;
  const setGoal = () => navigate(GOALS_PATH, { state: { exerciseId } satisfies GoalsPageState });
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(LIBRARY_PATH));

  return (
    <>
      <PageHeader
        title={exercise.name}
        subtitle={`${MUSCLE_LABELS[exercise.primaryMuscle]} · ${EQUIPMENT_LABELS[exercise.equipment]}`}
        onBack={back}
      />
      <div className="space-y-7 p-4 pb-8">
        <Card className="space-y-3 overflow-hidden p-3">
          <div className="-mx-1 rounded-2xl bg-black/20">
            <ExerciseModel
              key={exercise.id}
              model={guide.model}
              equipment={exercise.equipment}
              primary={exercise.primaryMuscle}
              secondary={secondary}
              label={`Animation du mouvement : ${exercise.name}`}
            />
          </div>
          <div className="space-y-1.5 px-1 pb-1">
            <Legend color="hot" label="Muscle principal">
              {MUSCLE_LABELS[exercise.primaryMuscle]}
            </Legend>
            {secondary.length > 0 && (
              <Legend color="soft" label="Travaillent aussi">
                {secondary.map((m) => MUSCLE_LABELS[m]).join(', ')}
              </Legend>
            )}
          </div>
        </Card>

        {guide.guessed && guide.movement && (
          <p className="px-1 text-sm text-muted">Fiche du mouvement le plus proche : {MOVEMENTS[guide.movement].name}.</p>
        )}

        {guide.steps.length > 0 && (
          <Section title="Comment faire">
            <Card>
              <Bullets items={guide.steps} icon="step" />
            </Card>
          </Section>
        )}

        {guide.tips.length > 0 && (
          <Section title="Conseils">
            <Card>
              <Bullets items={guide.tips} icon="tip" />
            </Card>
          </Section>
        )}

        {guide.avoid.length > 0 && (
          <Section title="À éviter">
            <Card>
              <Bullets items={guide.avoid} icon="avoid" />
            </Card>
          </Section>
        )}

        <Section title="Mes stats">
          {entry === undefined ? null : !done ? (
            <Card>
              <p className="text-lg font-semibold">Pas encore pratiqué</p>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <StatTile label="Séances" value={String(entry!.sessions)} />
                {entry!.bestE1rm !== null ? (
                  <StatTile label="1RM estimé" value={formatKg(Math.round(entry!.bestE1rm))} tone="good" />
                ) : (
                  <StatTile label="Répétitions max" value={String(entry!.maxReps ?? 0)} tone="good" />
                )}
                <StatTile
                  label="Dernière fois"
                  value={formatAgo(new Date(`${entry!.lastDate}T12:00:00`).getTime()).replace('il y a ', '')}
                />
              </div>
              {entry!.maxWeight !== null && entry!.maxWeight > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label="Charge max" value={formatKg(entry!.maxWeight)} />
                  <StatTile label="Séries" value={String(entry!.sets)} />
                  <StatTile
                    label="Progrès"
                    value={entry!.progress === null ? '—' : `${entry!.progress > 0 ? '+' : ''}${Math.round(entry!.progress * 100)} %`}
                    tone={entry!.progress !== null && entry!.progress > 0 ? 'good' : undefined}
                  />
                </div>
              )}
              {coaching && <LoadCard exercise={coaching} />}
              {coaching && (coaching.forecast.candidate || coaching.forecast.projection) && <ForecastCard exercise={coaching} />}
            </div>
          )}
        </Section>

        {done && <ExerciseProgress exerciseId={exercise.id} name={exercise.name} />}

        <Section title="Mes objectifs">
          {goals && goals.length > 0 && (
            <ul className="space-y-2">
              {goals.map((goal) => (
                <li key={goal.goal.id}>
                  <Link to={GOALS_PATH} className="block rounded-3xl border border-line bg-surface p-4 active:bg-raised">
                    <div className="flex items-baseline gap-3">
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-lg font-bold tabular-nums">
                        {goal.achievedOn && <IconTrophy className="size-5 text-gold" />}
                        {formatGoalTarget(goal.goal)}
                      </span>
                      <span className={`shrink-0 font-semibold tabular-nums ${goal.achievedOn ? 'text-gold' : 'text-accent'}`}>
                        {goal.achievedOn ? 'Atteint' : `${Math.round(goal.ratio * 100)} %`}
                      </span>
                    </div>
                    <GoalBar ratio={goal.ratio} achieved={goal.achievedOn !== null} className="mt-2" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Button onClick={setGoal}>
            <IconTarget className="size-5" />
            Fixer un objectif
          </Button>
        </Section>

        <LinkRow
          to={`/reglages/exercices/${encodeURIComponent(exercise.id)}`}
          title="Réglages de l’exercice"
          detail="Nom, muscles, matériel, pas de charge"
        />
      </div>
    </>
  );
}
