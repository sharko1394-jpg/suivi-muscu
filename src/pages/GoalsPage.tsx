import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  AppError,
  addPersonalGoal,
  deletePersonalGoal,
  getExercise,
  getGoalStatuses,
  listBodyweights,
  localDate,
  updatePersonalGoal,
  useLive,
  useSettings,
  type Exercise,
  type GoalStatus,
  type PersonalGoalKind,
} from '../data';
import { Button, Card, ConfirmDialog, PageHeader, Section } from '../ui/components';
import { HeaderButton, SegmentedControl, Stepper, WeightField } from '../ui/controls';
import { ExercisePicker } from '../ui/ExerciseBrowser';
import {
  formatDaysLeft,
  formatGoalTarget,
  formatGoalValue,
  formatShortDate,
  messageOf,
} from '../ui/format';
import { useNow } from '../ui/hooks';
import { IconChevronRight, IconPlus, IconTarget, IconTrophy } from '../ui/icons';
import { Sheet } from '../ui/overlays';
import { useToast } from '../ui/toast';
import { GoalBar } from './widgets';

/** Ouvre la page avec le formulaire déjà prêt pour cet exercice (depuis la bibliothèque). */
export interface GoalsPageState {
  exerciseId?: string;
}

export default function GoalsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const now = useNow(60_000);
  const goals = useLive(() => getGoalStatuses(now), [localDate(now)]);
  const prefill = (location.state as GoalsPageState | null)?.exerciseId ?? null;
  const [creating, setCreating] = useState(prefill !== null);
  const [editing, setEditing] = useState<GoalStatus | null>(null);

  const active = (goals ?? []).filter((g) => g.achievedOn === null);
  const achieved = (goals ?? []).filter((g) => g.achievedOn !== null);
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  return (
    <>
      <PageHeader
        title="Mes objectifs"
        onBack={back}
        action={
          <HeaderButton label="Nouvel objectif" primary onClick={() => setCreating(true)}>
            <IconPlus />
          </HeaderButton>
        }
      />
      <div className="space-y-6 p-4 pb-8">
        {goals !== undefined && goals.length === 0 && (
          <Card className="space-y-4 text-center">
            <IconTarget className="mx-auto size-12 text-accent" />
            <p className="text-lg font-semibold">Aucun objectif pour l’instant</p>
            <Button variant="primary" onClick={() => setCreating(true)}>
              Fixer un objectif
            </Button>
          </Card>
        )}

        {active.length > 0 && (
          <Section title="En cours">
            <ul className="space-y-2">
              {active.map((status) => (
                <li key={status.goal.id}>
                  <GoalCard status={status} onOpen={() => setEditing(status)} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {achieved.length > 0 && (
          <Section title="Atteints">
            <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
              {achieved.map((status) => (
                <li key={status.goal.id} className="border-b border-line/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setEditing(status)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-raised"
                  >
                    <IconTrophy className="size-6 shrink-0 text-gold" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{status.title}</span>
                      <span className="block text-sm text-muted">
                        {formatGoalTarget(status.goal)} · atteint le {formatShortDate(status.achievedOn!)}
                      </span>
                    </span>
                    <IconChevronRight className="shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* Monté seulement quand il est ouvert : chaque nouvel objectif part d'un formulaire vierge. */}
      {creating && <NewGoalSheet open prefillExerciseId={prefill} onClose={() => setCreating(false)} />}
      <EditGoalSheet status={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function GoalCard({ status, onOpen }: { status: GoalStatus; onOpen: () => void }) {
  const { goal, current, startValue, ratio, daysLeft } = status;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-3xl border border-line bg-surface p-4 text-left active:bg-raised"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-muted">{status.title}</p>
          <p className="text-2xl font-bold leading-tight tabular-nums">{formatGoalTarget(goal)}</p>
        </div>
        <span className="shrink-0 text-2xl font-bold text-accent tabular-nums">{Math.round(ratio * 100)} %</span>
      </div>
      <GoalBar ratio={ratio} achieved={false} className="mt-3" />
      <div className="mt-2 flex justify-between gap-3 text-sm text-muted tabular-nums">
        <span>Départ : {formatGoalValue(status, startValue)}</span>
        <span>Maintenant : {current === null ? '—' : formatGoalValue(status, current)}</span>
      </div>
      {goal.deadline && daysLeft !== null && (
        <p className={`mt-1 text-sm font-medium ${daysLeft < 0 ? 'text-gold' : 'text-muted'}`}>
          Avant le {formatShortDate(goal.deadline)} · {formatDaysLeft(daysLeft)}
        </p>
      )}
    </button>
  );
}

// ---------- Nouvel objectif ----------

const KINDS: { value: PersonalGoalKind; label: string }[] = [
  { value: 'lift', label: 'Charge' },
  { value: 'bodyweight', label: 'Poids' },
  { value: 'sessions', label: 'Séances' },
];

/** Séances : de 1 en 1 jusqu'à 5, puis de 5 en 5. */
const nextCount = (value: number, direction: 1 | -1) =>
  direction > 0 ? (value < 5 ? value + 1 : value + 5) : value > 5 ? value - 5 : Math.max(1, value - 1);

const dateField =
  'h-14 w-full min-w-0 rounded-2xl border border-line bg-raised px-4 text-ink outline-none focus:border-accent';

function NewGoalSheet({
  open,
  prefillExerciseId,
  onClose,
}: {
  open: boolean;
  prefillExerciseId: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const settings = useSettings();
  const weighIns = useLive(() => listBodyweights(), []);
  const [kind, setKind] = useState<PersonalGoalKind>('lift');
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [picking, setPicking] = useState(false);
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState(5);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [sessions, setSessions] = useState(20);
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = localDate(Date.now());

  // Ouvert depuis la fiche d'un exercice : il est déjà choisi.
  useEffect(() => {
    if (!open || !prefillExerciseId) return;
    void getExercise(prefillExerciseId).then((found) => {
      if (!found) return;
      setKind('lift');
      setExercise(found);
      if (found.equipment === 'poids-du-corps') setWeight(0);
    });
  }, [open, prefillExerciseId]);

  if (!open) return null;
  const noWeighIn = weighIns !== undefined && weighIns.length === 0;

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      if (kind === 'lift') {
        if (!exercise) throw new AppError('Choisis un exercice.');
        if (weight === null) throw new AppError('Indique la charge visée (0 kg pour le poids du corps).');
        await addPersonalGoal({ kind, exerciseId: exercise.id, target: weight, reps, deadline: deadline || null });
      } else if (kind === 'bodyweight') {
        if (bodyweight === null) throw new AppError('Indique le poids visé.');
        await addPersonalGoal({ kind, target: bodyweight, currentWeight, deadline: deadline || null });
      } else {
        await addPersonalGoal({ kind, target: sessions, deadline: deadline || null });
      }
      toast('Objectif fixé');
      onClose();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open title="Nouvel objectif" onClose={onClose}>
        <div className="space-y-5">
          <SegmentedControl label="Type d’objectif" value={kind} options={KINDS} onChange={(value) => { setKind(value); setError(null); }} />

          {kind === 'lift' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-2 text-left active:bg-line"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-muted">Exercice</span>
                  <span className="block truncate text-lg font-semibold">{exercise?.name ?? 'Choisir un exercice'}</span>
                </span>
                <IconChevronRight className="shrink-0 text-muted" />
              </button>
              <WeightField
                label="Charge visée"
                value={weight}
                step={exercise?.weightStep ?? settings?.weightStep ?? 2.5}
                onChange={setWeight}
              />
              <Stepper
                label={weight === 0 ? 'Répétitions au poids du corps' : 'Pour au moins'}
                value={`${reps} rép.`}
                onDecrement={() => setReps((r) => Math.max(1, r - 1))}
                onIncrement={() => setReps((r) => Math.min(100, r + 1))}
                canDecrement={reps > 1}
                canIncrement={reps < 100}
              />
            </div>
          )}

          {kind === 'bodyweight' && (
            <div className="space-y-4">
              <WeightField label="Poids visé" value={bodyweight} step={0.5} onChange={setBodyweight} />
              {noWeighIn && <WeightField label="Mon poids actuel" value={currentWeight} step={0.5} onChange={setCurrentWeight} />}
            </div>
          )}

          {kind === 'sessions' && (
            <Stepper
              label="Séances à faire"
              value={String(sessions)}
              onDecrement={() => setSessions((s) => nextCount(s, -1))}
              onIncrement={() => setSessions((s) => Math.min(1000, nextCount(s, 1)))}
              canDecrement={sessions > 1}
            />
          )}

          <label className="block space-y-2">
            <span className="block text-sm font-medium text-muted">Date limite (facultatif)</span>
            <div className="flex gap-2">
              <input
                type="date"
                value={deadline}
                min={today}
                onChange={(event) => setDeadline(event.target.value)}
                aria-label="Date limite"
                className={dateField}
              />
              {deadline !== '' && (
                <Button variant="ghost" className="w-auto shrink-0 px-4 text-base" onClick={() => setDeadline('')}>
                  Aucune
                </Button>
              )}
            </div>
          </label>

          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}

          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            Fixer l’objectif
          </Button>
        </div>
      </Sheet>

      <ExercisePicker
        open={picking}
        title="Quel exercice ?"
        onPick={(picked) => {
          setExercise(picked);
          if (picked.equipment === 'poids-du-corps' && weight === null) setWeight(0);
          setPicking(false);
          setError(null);
        }}
        onCreate={(name) => navigate('/reglages/exercices/nouveau', { state: { name } })}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

// ---------- Modifier ou supprimer ----------

function EditGoalSheet({ status, onClose }: { status: GoalStatus | null; onClose: () => void }) {
  const toast = useToast();
  const settings = useSettings();
  const [target, setTarget] = useState<number | null>(null);
  const [reps, setReps] = useState(1);
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!status) return;
    setTarget(status.goal.target);
    setReps(status.goal.reps);
    setDeadline(status.goal.deadline ?? '');
    setError(null);
  }, [status]);

  if (!status) return null;
  const { goal } = status;
  const achieved = status.achievedOn !== null;

  const save = async () => {
    try {
      await updatePersonalGoal(goal.id, { target: target ?? goal.target, reps, deadline: deadline || null });
      toast('Objectif modifié');
      onClose();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  return (
    <>
      <Sheet open title={status.title} onClose={onClose}>
        <div className="space-y-5">
          <p className="text-muted">
            {achieved
              ? `${formatGoalTarget(goal)} · atteint le ${formatShortDate(status.achievedOn!)}`
              : `Objectif : ${formatGoalTarget(goal)}`}
          </p>

          {!achieved && (
            <>
              {goal.kind === 'sessions' ? (
                <Stepper
                  label="Séances à faire"
                  value={String(target ?? goal.target)}
                  onDecrement={() => setTarget((t) => nextCount(t ?? goal.target, -1))}
                  onIncrement={() => setTarget((t) => Math.min(1000, nextCount(t ?? goal.target, 1)))}
                  canDecrement={(target ?? goal.target) > 1}
                />
              ) : (
                <WeightField
                  label={goal.kind === 'bodyweight' ? 'Poids visé' : 'Charge visée'}
                  value={target}
                  step={goal.kind === 'bodyweight' ? 0.5 : (settings?.weightStep ?? 2.5)}
                  onChange={setTarget}
                />
              )}
              {goal.kind === 'lift' && (
                <Stepper
                  label="Pour au moins"
                  value={`${reps} rép.`}
                  onDecrement={() => setReps((r) => Math.max(1, r - 1))}
                  onIncrement={() => setReps((r) => Math.min(100, r + 1))}
                  canDecrement={reps > 1}
                  canIncrement={reps < 100}
                />
              )}
              <label className="block space-y-2">
                <span className="block text-sm font-medium text-muted">Date limite (facultatif)</span>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={deadline}
                    min={localDate(Date.now())}
                    onChange={(event) => setDeadline(event.target.value)}
                    aria-label="Date limite"
                    className={dateField}
                  />
                  {deadline !== '' && (
                    <Button variant="ghost" className="w-auto shrink-0 px-4 text-base" onClick={() => setDeadline('')}>
                      Aucune
                    </Button>
                  )}
                </div>
              </label>
              {error && (
                <p role="alert" className="text-danger">
                  {error}
                </p>
              )}
              <Button variant="primary" onClick={() => void save()}>
                Enregistrer
              </Button>
            </>
          )}

          <Button variant="ghostDanger" onClick={() => setConfirmDelete(true)}>
            Supprimer l’objectif
          </Button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cet objectif ?"
        confirmLabel="Supprimer"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void deletePersonalGoal(goal.id).then(() => {
            toast('Objectif supprimé');
            onClose();
          });
        }}
      >
        <p>
          {status.title} : {formatGoalTarget(goal)}. Tes séances ne sont pas touchées.
        </p>
      </ConfirmDialog>
    </>
  );
}
