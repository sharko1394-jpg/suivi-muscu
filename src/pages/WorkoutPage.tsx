import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  MUSCLE_LABELS,
  PLANNED_LIMITS,
  addPlannedExercise,
  deleteWorkout,
  duplicateWorkout,
  getProgram,
  getWorkout,
  isLinkedWithNext,
  listExercises,
  listWorkouts,
  removePlannedExercise,
  renameWorkout,
  reorderPlannedExercises,
  replacePlannedExercise,
  setSupersetWithNext,
  updatePlannedExercise,
  useLive,
  useSettings,
  type Exercise,
  type PlannedExercise,
  type PlannedPatch,
  type Program,
  type ProgramWorkout,
} from '../data';
import { Button, Card, ConfirmDialog, PageHeader } from '../ui/components';
import { HeaderButton, Stepper, Switch, WeightField } from '../ui/controls';
import { ExercisePicker } from '../ui/ExerciseBrowser';
import { formatReps, formatRest, messageOf } from '../ui/format';
import { IconChevronRight, IconLink, IconPlus } from '../ui/icons';
import { ActionSheet, PromptDialog, Sheet, type SheetAction } from '../ui/overlays';
import { SortableList } from '../ui/SortableList';
import { useToast } from '../ui/toast';
import { PROGRAM_LIST, programPath, workoutPath } from './ProgramListPage';
import { MuscleChips, ProgramVolumeCard, workoutMuscles } from './ProgramVolume';

/** État du sélecteur d'exercices : ajout, ou remplacement d'un exercice précis. */
type Picking = { mode: 'add' } | { mode: 'replace'; itemId: string } | null;

export function WorkoutPage() {
  const { programId, workoutId } = useParams();
  const back = programId ? programPath(programId) : PROGRAM_LIST;
  const loaded = useLive(async () => {
    const workout = workoutId ? await getWorkout(workoutId) : undefined;
    const program = workout ? await getProgram(workout.programId) : undefined;
    return { workout: workout ?? null, program: program ?? null };
  }, [workoutId]);

  if (loaded === undefined) return <PageHeader title="Séance" backTo={back} />;
  if (loaded.workout === null || loaded.program === null) {
    return (
      <>
        <PageHeader title="Séance" backTo={back} />
        <p className="p-6 text-center text-muted">Cette séance n’existe plus.</p>
      </>
    );
  }
  return <WorkoutView workout={loaded.workout} program={loaded.program} />;
}

function WorkoutView({ workout, program }: { workout: ProgramWorkout; program: Program }) {
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const exercises = useLive(() => listExercises({ includeArchived: true }), []);
  const byId = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);
  // Toutes les séances du programme : pour le volume de la semaine.
  const programWorkouts = useLive(() => listWorkouts(program.id), [program.id]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picking, setPicking] = useState<Picking>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const run = (task: () => Promise<unknown>) => {
    task().catch((error) => toast(messageOf(error), 'error'));
  };

  const back = programPath(program.id);
  const editingIndex = workout.items.findIndex((item) => item.id === editingId);
  const editing = editingIndex === -1 ? null : workout.items[editingIndex];
  const nameOf = (item: PlannedExercise) => byId.get(item.exerciseId)?.name ?? 'Exercice supprimé';

  const menu: SheetAction[] = [
    { label: 'Renommer', onSelect: () => setRenaming(true) },
    {
      label: 'Dupliquer',
      onSelect: () =>
        run(async () => {
          const copy = await duplicateWorkout(workout.id);
          toast('Séance dupliquée');
          navigate(workoutPath(program.id, copy.id));
        }),
    },
    { label: 'Supprimer la séance', danger: true, onSelect: () => setConfirmDelete(true) },
  ];

  function handlePick(exercise: Exercise) {
    if (picking?.mode === 'replace') {
      const { itemId } = picking;
      setPicking(null);
      run(async () => {
        await replacePlannedExercise(workout.id, itemId, exercise.id);
        toast('Exercice remplacé');
      });
    } else {
      // Le sélecteur reste ouvert : on peut ajouter plusieurs exercices à la suite.
      run(async () => {
        await addPlannedExercise(workout.id, exercise.id);
        toast(`Ajouté : ${exercise.name}`);
      });
    }
  }

  /** Création d'un exercice introuvable : il sera ajouté à la séance dès sa création. */
  function handleCreate(name: string) {
    navigate('/reglages/exercices/nouveau', {
      state: {
        name,
        thenAddTo: {
          workoutId: workout.id,
          replaceItemId: picking?.mode === 'replace' ? picking.itemId : null,
        },
      },
    });
  }

  return (
    <>
      <PageHeader
        title={workout.name}
        subtitle={program.name}
        backTo={back}
        action={<HeaderButton label="Actions sur la séance" onClick={() => setMenuOpen(true)} />}
      />

      <div className="space-y-4 p-4 pb-8">
        {workout.items.length > 0 && <MuscleChips items={workout.items} exercises={byId} />}

        {workout.items.length === 0 ? (
          <Card>
            <p className="text-muted">
              Cette séance est vide. Ajoute les exercices dans l’ordre où tu les fais.
            </p>
          </Card>
        ) : (
          <SortableList
            items={workout.items}
            onReorder={(ids) => run(() => reorderPlannedExercises(workout.id, ids))}
            className="overflow-hidden rounded-3xl border border-line bg-surface"
          >
            {(item, handle, index) => {
              const inSuperset = item.supersetGroup !== null;
              return (
                <div
                  className={`flex min-h-18 items-stretch border-l-4 ${
                    inSuperset ? 'border-accent' : 'border-transparent'
                  }`}
                >
                  {handle}
                  <button
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className="min-w-0 flex-1 py-3 pr-4 text-left active:bg-raised"
                  >
                    <p className="text-lg font-semibold leading-snug">{nameOf(item)}</p>
                    <p className="text-sm text-muted">
                      {item.sets} × {formatReps(item.repMin, item.repMax)}
                      {byId.get(item.exerciseId) ? ` · ${MUSCLE_LABELS[byId.get(item.exerciseId)!.primaryMuscle]}` : ''}
                    </p>
                    {item.note !== '' && (
                      <p className="mt-0.5 text-sm text-ink/80">«&nbsp;{item.note}&nbsp;»</p>
                    )}
                    {isLinkedWithNext(workout.items, index) && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-accent">
                        <IconLink className="size-4" />
                        Superset avec le suivant
                      </p>
                    )}
                  </button>
                </div>
              );
            }}
          </SortableList>
        )}

        <Button variant="primary" onClick={() => setPicking({ mode: 'add' })}>
          <IconPlus />
          Ajouter un exercice
        </Button>

        {programWorkouts && programWorkouts.some((w) => w.items.length > 0) && (
          <details className="group space-y-3 pt-2">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-1">
              <span className="min-w-0 flex-1 text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-muted">
                Séries par semaine · tout le programme
              </span>
              <IconChevronRight className="size-5 shrink-0 text-muted transition-transform group-open:rotate-90" />
            </summary>
            <ProgramVolumeCard
              program={program}
              workouts={programWorkouts}
              highlight={new Set(workoutMuscles(workout.items, byId).map((m) => m.muscle))}
            />
          </details>
        )}

      </div>

      <Sheet open={editing !== null} title={editing ? nameOf(editing) : ''} onClose={() => setEditingId(null)}>
        {editing && (
          <ItemEditor
            // Un remplacement change l'exercice : on repart de champs neufs.
            key={`${editing.id}:${editing.exerciseId}`}
            item={editing}
            weightStep={byId.get(editing.exerciseId)?.weightStep ?? settings?.weightStep ?? 2.5}
            hasNext={editingIndex < workout.items.length - 1}
            linkedWithNext={isLinkedWithNext(workout.items, editingIndex)}
            onChange={(patch) => run(() => updatePlannedExercise(workout.id, editing.id, patch))}
            onLink={(linked) => run(() => setSupersetWithNext(workout.id, editing.id, linked))}
            onReplace={() => {
              setPicking({ mode: 'replace', itemId: editing.id });
              setEditingId(null);
            }}
            onRemove={() => {
              setEditingId(null);
              run(async () => {
                await removePlannedExercise(workout.id, editing.id);
                toast('Exercice retiré de la séance');
              });
            }}
          />
        )}
      </Sheet>

      <ExercisePicker
        open={picking !== null}
        title={picking?.mode === 'replace' ? 'Remplacer par…' : 'Ajouter un exercice'}
        doneLabel={picking?.mode === 'add' ? 'Terminé' : undefined}
        onPick={handlePick}
        onCreate={handleCreate}
        onClose={() => setPicking(null)}
      />

      <ActionSheet open={menuOpen} title={workout.name} actions={menu} onClose={() => setMenuOpen(false)} />

      <PromptDialog
        open={renaming}
        title="Renommer la séance"
        label="Nom de la séance"
        initialValue={workout.name}
        confirmLabel="Renommer"
        onCancel={() => setRenaming(false)}
        onConfirm={async (name) => {
          await renameWorkout(workout.id, name);
          setRenaming(false);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette séance ?"
        confirmLabel="Supprimer la séance"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(async () => {
            await deleteWorkout(workout.id);
            toast('Séance supprimée');
            navigate(back, { replace: true });
          })
        }
      >
        <p>
          «&nbsp;{workout.name}&nbsp;» sera retirée du programme, avec ses exercices prévus.
        </p>
        <p>Tes séances déjà réalisées restent intactes dans l’historique.</p>
      </ConfirmDialog>
    </>
  );
}

/** Réglages d'un exercice prévu. Chaque changement est enregistré immédiatement. */
function ItemEditor({
  item,
  weightStep,
  hasNext,
  linkedWithNext,
  onChange,
  onLink,
  onReplace,
  onRemove,
}: {
  item: PlannedExercise;
  weightStep: number;
  hasNext: boolean;
  linkedWithNext: boolean;
  onChange: (patch: PlannedPatch) => void;
  onLink: (linked: boolean) => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const { sets, reps, restSec } = PLANNED_LIMITS;
  const [note, setNote] = useState(item.note);

  return (
    <div className="space-y-5">
      <Stepper
        label="Séries"
        value={String(item.sets)}
        onDecrement={() => onChange({ sets: item.sets - 1 })}
        onIncrement={() => onChange({ sets: item.sets + 1 })}
        canDecrement={item.sets > sets.min}
        canIncrement={item.sets < sets.max}
      />
      <Stepper
        label="Répétitions minimum"
        value={String(item.repMin)}
        onDecrement={() => onChange({ repMin: item.repMin - 1 })}
        onIncrement={() => onChange({ repMin: item.repMin + 1 })}
        canDecrement={item.repMin > reps.min}
        canIncrement={item.repMin < reps.max}
      />
      <Stepper
        label="Répétitions maximum"
        value={String(item.repMax)}
        onDecrement={() => onChange({ repMax: item.repMax - 1 })}
        onIncrement={() => onChange({ repMax: item.repMax + 1 })}
        canDecrement={item.repMax > reps.min}
        canIncrement={item.repMax < reps.max}
      />
      <Stepper
        label="Repos"
        value={item.restSec === 0 ? 'aucun' : formatRest(item.restSec)}
        onDecrement={() => onChange({ restSec: item.restSec - restSec.step })}
        onIncrement={() => onChange({ restSec: item.restSec + restSec.step })}
        canDecrement={item.restSec > restSec.min}
        canIncrement={item.restSec < restSec.max}
      />
      <WeightField
        label="Charge cible (facultatif)"
        value={item.targetWeight}
        step={weightStep}
        onChange={(targetWeight) => onChange({ targetWeight })}
      />

      <label className="block space-y-2">
        <span className="block text-sm font-medium text-muted">Note permanente (facultatif)</span>
        <input
          type="text"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            onChange({ note: event.target.value });
          }}
          placeholder="Ex. siège cran 4"
          maxLength={PLANNED_LIMITS.noteLength}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          className="h-14 w-full rounded-2xl border border-line bg-black/30 px-4 text-ink outline-none placeholder:text-muted focus:border-accent"
        />
      </label>

      {hasNext && (
        <Switch
          label="Superset avec l’exercice suivant"
          checked={linkedWithNext}
          onChange={onLink}
        />
      )}

      <div className="grid gap-2 border-t border-line/60 pt-5">
        <Button onClick={onReplace}>Remplacer l’exercice</Button>
        <Button variant="danger" onClick={onRemove}>
          Retirer de la séance
        </Button>
      </div>
    </div>
  );
}
