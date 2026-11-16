import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  RPE_VALUES,
  SET_LIMITS,
  SET_TYPE_LABELS,
  addDoneSet,
  getSessionDetail,
  listExercises,
  localDate,
  removeHistorySet,
  setSessionDate,
  setSessionExerciseNote,
  setSessionNote,
  updateSet,
  useLive,
  useSettings,
  type SessionDetail,
  type SetEntry,
  type SetType,
} from '../data';
import { Button, Chip, PageHeader, Section } from '../ui/components';
import { formatNumber, formatSet, messageOf } from '../ui/format';
import { IconPlus } from '../ui/icons';
import { Sheet } from '../ui/overlays';
import { useToast } from '../ui/toast';
import { BigStepper, summaryPath } from './SessionPage';

/** Correction d'une séance terminée. Chaque changement est enregistré immédiatement. */
export function EditSessionPage() {
  const { sessionId } = useParams();
  const back = sessionId ? summaryPath(sessionId) : '/historique';
  const loaded = useLive(
    async () => ({ detail: sessionId ? ((await getSessionDetail(sessionId)) ?? null) : null }),
    [sessionId],
  );

  if (loaded === undefined) return <PageHeader title="Corriger la séance" backTo={back} />;
  if (loaded.detail === null || loaded.detail.session.status !== 'done') {
    return (
      <>
        <PageHeader title="Corriger la séance" backTo="/historique" />
        <p className="p-6 text-center text-muted">Cette séance n’existe plus.</p>
      </>
    );
  }
  return <EditView detail={loaded.detail} back={back} />;
}

function EditView({ detail, back }: { detail: SessionDetail; back: string }) {
  const { session, exercises } = detail;
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  // Retour au bilan d'où l'on vient, sans empiler les pages.
  const leave = () => (location.key === 'default' ? navigate(back, { replace: true }) : navigate(-1));
  const settings = useSettings();
  const library = useLive(() => listExercises({ includeArchived: true }), []);
  const stepOf = useMemo(() => new Map((library ?? []).map((e) => [e.id, e.weightStep])), [library]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [sessionNote, setNote] = useState(session.note);

  const run = (task: () => Promise<unknown>) => {
    task().catch((error) => toast(messageOf(error), 'error'));
  };

  const editing = exercises.flatMap((e) => e.sets).find((s) => s.id === editingId) ?? null;
  const editingExercise = exercises.find((e) => e.exercise.id === editing?.sessionExerciseId);

  return (
    <>
      <PageHeader title="Corriger la séance" subtitle={session.workoutName} onBack={leave} />

      <div className="space-y-8 p-4 pb-8">

        <Section title="Jour de la séance">
          <input
            type="date"
            value={session.date}
            max={localDate(Date.now())}
            onChange={(event) =>
              event.target.value !== '' && run(() => setSessionDate(session.id, event.target.value))
            }
            aria-label="Jour de la séance"
            className="h-14 w-full rounded-2xl border border-line bg-raised px-4 text-ink outline-none focus:border-accent"
          />
        </Section>

        {exercises.map(({ exercise, sets }) => (
          <Section key={exercise.id} title={exercise.exerciseName}>
            <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
              {sets.map((set, index) => (
                <li key={set.id} className="border-b border-line/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setEditingId(set.id)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-raised"
                  >
                    <span className="w-5 shrink-0 text-center font-semibold tabular-nums text-muted">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-lg font-semibold tabular-nums">
                      {formatSet(set)}
                      {set.rpe !== null && (
                        <span className="text-sm font-normal text-muted"> · RPE {formatNumber(set.rpe)}</span>
                      )}
                    </span>
                    {set.type !== 'normal' && (
                      <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-xs font-semibold text-muted">
                        {SET_TYPE_LABELS[set.type]}
                      </span>
                    )}
                    <span className="shrink-0 text-sm font-semibold text-accent">Modifier</span>
                  </button>
                </li>
              ))}
            </ul>
            <Button onClick={() => run(() => addDoneSet(exercise.id))} className="min-h-12 text-base">
              <IconPlus />
              Ajouter une série
            </Button>
            <NoteInput
              key={exercise.id}
              label="Note sur cet exercice"
              initial={exercise.note}
              onChange={(note) => run(() => setSessionExerciseNote(exercise.id, note))}
            />
          </Section>
        ))}

        <Section title="Note de séance">
          <textarea
            value={sessionNote}
            onChange={(event) => {
              setNote(event.target.value);
              run(() => setSessionNote(session.id, event.target.value));
            }}
            aria-label="Note de séance"
            rows={3}
            maxLength={500}
            className="w-full rounded-2xl border border-line bg-raised px-4 py-3 text-ink outline-none focus:border-accent"
          />
        </Section>
      </div>

      <Sheet
        open={editing !== null}
        title={editingExercise?.exercise.exerciseName ?? ''}
        onClose={() => setEditingId(null)}
      >
        {editing && (
          <SetForm
            set={editing}
            weightStep={stepOf.get(editing.exerciseId) ?? settings?.weightStep ?? 2.5}
            repStep={settings?.repStep ?? 1}
            onChange={(patch) => run(() => updateSet(editing.id, patch))}
            onRemove={() => {
              setEditingId(null);
              run(async () => {
                await removeHistorySet(editing.id);
                toast('Série supprimée');
              });
            }}
            onDone={() => setEditingId(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function SetForm({
  set,
  weightStep,
  repStep,
  onChange,
  onRemove,
  onDone,
}: {
  set: SetEntry;
  weightStep: number;
  repStep: number;
  onChange: (patch: { weight?: number; reps?: number; rpe?: number | null; type?: SetType }) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <BigStepper
        label="Charge"
        unit="kg"
        value={set.weight}
        step={weightStep}
        min={SET_LIMITS.weight.min}
        max={SET_LIMITS.weight.max}
        onChange={(weight) => onChange({ weight })}
      />
      <BigStepper
        label="Répétitions"
        unit="rép."
        value={set.reps}
        step={repStep}
        min={SET_LIMITS.reps.min}
        max={SET_LIMITS.reps.max}
        integer
        onChange={(reps) => onChange({ reps })}
      />

      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted">Type de série</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SET_TYPE_LABELS) as SetType[]).map((type) => (
            <Chip key={type} selected={set.type === type} onClick={() => onChange({ type })}>
              {SET_TYPE_LABELS[type]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted">RPE (facultatif)</p>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {RPE_VALUES.map((value) => (
            <Chip
              key={value}
              selected={set.rpe === value}
              onClick={() => onChange({ rpe: set.rpe === value ? null : value })}
            >
              {formatNumber(value)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-2 border-t border-line/60 pt-4">
        <Button variant="primary" onClick={onDone}>
          C’est bon
        </Button>
        <Button variant="danger" onClick={onRemove}>
          Supprimer cette série
        </Button>
      </div>
    </div>
  );
}

function NoteInput({
  label,
  initial,
  onChange,
}: {
  label: string;
  initial: string;
  onChange: (note: string) => void;
}) {
  const [note, setNote] = useState(initial);
  return (
    <input
      type="text"
      value={note}
      onChange={(event) => {
        setNote(event.target.value);
        onChange(event.target.value);
      }}
      aria-label={label}
      placeholder={`${label} (facultatif)`}
      maxLength={300}
      autoComplete="off"
      autoCapitalize="sentences"
      enterKeyHint="done"
      className="h-13 w-full rounded-2xl border border-line bg-black/30 px-4 text-ink outline-none placeholder:text-muted focus:border-accent"
    />
  );
}
