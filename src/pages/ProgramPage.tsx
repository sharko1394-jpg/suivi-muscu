import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  WEEKDAYS,
  WEEKDAY_LABELS,
  addWorkout,
  archiveProgram,
  deleteProgram,
  duplicateProgram,
  getProgram,
  listWorkouts,
  renameProgram,
  reorderWorkouts,
  setActiveProgram,
  setFixedDay,
  setNextWorkout,
  setScheduleMode,
  unarchiveProgram,
  useLive,
  type Program,
  type ProgramWorkout,
  type Weekday,
} from '../data';
import { Button, Card, ConfirmDialog, PageHeader, Section } from '../ui/components';
import { HeaderButton, SegmentedControl } from '../ui/controls';
import { messageOf, plural } from '../ui/format';
import { IconChevronRight, IconPlus } from '../ui/icons';
import { ActionSheet, PromptDialog, type SheetAction } from '../ui/overlays';
import { SortableList } from '../ui/SortableList';
import { useToast } from '../ui/toast';
import { PROGRAM_LIST, programPath, workoutPath } from './ProgramListPage';

const selectClass =
  'h-13 w-full rounded-2xl border border-line bg-raised px-3 text-ink outline-none focus:border-accent';

export function ProgramPage() {
  const { programId } = useParams();
  const loaded = useLive(async () => {
    const program = programId ? await getProgram(programId) : undefined;
    return { program: program ?? null, workouts: program ? await listWorkouts(program.id) : [] };
  }, [programId]);

  if (loaded === undefined) return <PageHeader title="Programme" backTo={PROGRAM_LIST} />;
  if (loaded.program === null) {
    return (
      <>
        <PageHeader title="Programme" backTo={PROGRAM_LIST} />
        <p className="p-6 text-center text-muted">Ce programme n’existe plus.</p>
      </>
    );
  }
  return <ProgramView program={loaded.program} workouts={loaded.workouts} />;
}

function ProgramView({ program, workouts }: { program: Program; workouts: ProgramWorkout[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [addingWorkout, setAddingWorkout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** Lance une action et affiche l'erreur éventuelle. */
  const run = (task: () => Promise<unknown>) => {
    task().catch((error) => toast(messageOf(error), 'error'));
  };

  const archived = program.status === 'archived';
  const nextWorkoutId = program.rotation[program.nextRotationIndex];

  const menu: SheetAction[] = [
    { label: 'Renommer', onSelect: () => setRenaming(true) },
    {
      label: 'Dupliquer',
      onSelect: () =>
        run(async () => {
          const copy = await duplicateProgram(program.id);
          toast('Programme dupliqué');
          navigate(programPath(copy.id));
        }),
    },
    archived
      ? {
          label: 'Désarchiver',
          onSelect: () =>
            run(async () => {
              await unarchiveProgram(program.id);
              toast('Programme désarchivé');
            }),
        }
      : {
          label: 'Archiver',
          onSelect: () =>
            run(async () => {
              await archiveProgram(program.id);
              toast('Programme archivé');
              navigate(PROGRAM_LIST);
            }),
        },
    ...(archived
      ? [{ label: 'Supprimer définitivement', danger: true, onSelect: () => setConfirmDelete(true) }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={program.name}
        subtitle="Programme"
        backTo={PROGRAM_LIST}
        action={<HeaderButton label="Actions sur le programme" onClick={() => setMenuOpen(true)} />}
      />

      <div className="space-y-8 p-4 pb-8">
        {program.status === 'active' && (
          <p className="rounded-2xl border border-accent/50 bg-accent/10 px-4 py-3 font-semibold text-accent">
            Programme actif
          </p>
        )}
        {program.status === 'inactive' && (
          <Card className="space-y-3">
            <Button
              variant="primary"
              onClick={() =>
                run(async () => {
                  await setActiveProgram(program.id);
                  toast('Programme activé');
                })
              }
            >
              Utiliser ce programme
            </Button>
          </Card>
        )}
        {archived && (
          <Card className="space-y-3">
            <Button onClick={() => run(() => unarchiveProgram(program.id))}>Désarchiver</Button>
          </Card>
        )}

        <Section title="Séances">
          {workouts.length === 0 ? (
            <Card>
              <p className="text-muted">
                Aucune séance pour l’instant. Ajoute la première, par exemple «&nbsp;Upper
                A&nbsp;».
              </p>
            </Card>
          ) : (
            <SortableList
              items={workouts}
              onReorder={(ids) => run(() => reorderWorkouts(program.id, ids))}
              className="overflow-hidden rounded-3xl border border-line bg-surface"
            >
              {(workout, handle) => (
                <div className="flex min-h-18 items-stretch">
                  {handle}
                  <Link
                    to={workoutPath(program.id, workout.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 active:bg-raised"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold">{workout.name}</p>
                      <p className="text-sm text-muted">
                        {plural(workout.items.length, 'exercice')}
                      </p>
                    </div>
                    {program.scheduleMode === 'rotation' && workout.id === nextWorkoutId && (
                      <span className="shrink-0 rounded-full border border-accent/60 px-2.5 py-0.5 text-xs font-semibold text-accent">
                        Prochaine
                      </span>
                    )}
                    <IconChevronRight className="shrink-0 text-muted" />
                  </Link>
                </div>
              )}
            </SortableList>
          )}
          <Button onClick={() => setAddingWorkout(true)}>
            <IconPlus />
            Ajouter une séance
          </Button>
        </Section>

        <Section title="Planification">
          <Card className="space-y-4">
            <SegmentedControl
              label="Mode de planification"
              value={program.scheduleMode}
              options={[
                { value: 'rotation', label: 'Rotation' },
                { value: 'fixedDays', label: 'Jours fixes' },
              ]}
              onChange={(mode) => run(() => setScheduleMode(program.id, mode))}
            />

            {program.scheduleMode === 'rotation' ? (
              <>
                {workouts.length > 0 && (
                  <label className="block space-y-2">
                    <span className="block font-semibold">Prochaine séance</span>
                    <select
                      value={nextWorkoutId ?? ''}
                      onChange={(event) => run(() => setNextWorkout(program.id, event.target.value))}
                      className={selectClass}
                    >
                      {workouts.map((workout) => (
                        <option key={workout.id} value={workout.id}>
                          {workout.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            ) : (
              <>
                {workouts.length === 0 ? (
                  <p className="text-muted">Ajoute d’abord une séance pour la placer sur un jour.</p>
                ) : (
                  <div className="space-y-2">
                    {WEEKDAYS.map((day) => (
                      <DayRow
                        key={day}
                        day={day}
                        workoutId={program.fixedDays[day] ?? null}
                        workouts={workouts}
                        onChange={(workoutId) => run(() => setFixedDay(program.id, day, workoutId))}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        </Section>
      </div>

      <ActionSheet open={menuOpen} title={program.name} actions={menu} onClose={() => setMenuOpen(false)} />

      <PromptDialog
        open={renaming}
        title="Renommer le programme"
        label="Nom du programme"
        initialValue={program.name}
        confirmLabel="Renommer"
        onCancel={() => setRenaming(false)}
        onConfirm={async (name) => {
          await renameProgram(program.id, name);
          setRenaming(false);
        }}
      />

      <PromptDialog
        open={addingWorkout}
        title="Nouvelle séance"
        label="Nom de la séance"
        placeholder="Ex. Upper A"
        confirmLabel="Ajouter"
        onCancel={() => setAddingWorkout(false)}
        onConfirm={async (name) => {
          const workout = await addWorkout(program.id, name);
          navigate(workoutPath(program.id, workout.id));
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer ce programme ?"
        confirmLabel="Supprimer définitivement"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(async () => {
            await deleteProgram(program.id);
            toast('Programme supprimé');
            navigate(PROGRAM_LIST, { replace: true });
          })
        }
      >
        <p>
          Le programme «&nbsp;{program.name}&nbsp;» et ses {plural(workouts.length, 'séance')}{' '}
          seront effacés.
        </p>
        <p>Tes séances déjà réalisées restent intactes dans l’historique.</p>
      </ConfirmDialog>
    </>
  );
}

function DayRow({
  day,
  workoutId,
  workouts,
  onChange,
}: {
  day: Weekday;
  workoutId: string | null;
  workouts: ProgramWorkout[];
  onChange: (workoutId: string | null) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-24 shrink-0 font-semibold">{WEEKDAY_LABELS[day]}</span>
      <select
        value={workoutId ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        className={`${selectClass} ${workoutId === null ? 'text-muted' : ''}`}
      >
        <option value="">Repos</option>
        {workouts.map((workout) => (
          <option key={workout.id} value={workout.id}>
            {workout.name}
          </option>
        ))}
      </select>
    </label>
  );
}
