import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import {
  RECORD_LABELS,
  RPE_VALUES,
  SET_LIMITS,
  SET_TYPE_LABELS,
  abandonSession,
  addSessionExercise,
  addSet,
  adjustRest,
  clearRest,
  completeSet,
  finishSession,
  getActiveSession,
  getSessionScreenData,
  isCountedSet,
  listExercises,
  nextSetId,
  removeSessionExercise,
  removeSet,
  replaceSessionExercise,
  setSessionExerciseNote,
  setSessionNote,
  uncompleteSet,
  updateSet,
  useLive,
  useSettings,
  type Exercise,
  type FlowExercise,
  type RecordKind,
  type RestTimer,
  type SessionScreenExercise,
  type SetEntry,
  type SetPatch,
  type SetType,
  type Settings,
} from '../data';
import { Button, Chip, ConfirmDialog } from '../ui/components';
import { HeaderButton } from '../ui/controls';
import { ExercisePicker } from '../ui/ExerciseBrowser';
import {
  formatClock,
  formatLifts,
  formatNumber,
  formatPlanned,
  formatSet,
  formatShortDate,
  messageOf,
  plural,
} from '../ui/format';
import { useNow, useRestAlarm, useWakeLock } from '../ui/hooks';
import { IconCheck, IconChevronLeft, IconLink, IconMinus, IconPlus } from '../ui/icons';
import { ActionSheet, type SheetAction } from '../ui/overlays';
import { unlockAudio } from '../ui/sound';
import { useToast } from '../ui/toast';

export const SESSION_PATH = '/seance';
export const summaryPath = (sessionId: string) => `/bilan/${sessionId}`;

/** Repère de la zone de saisie de la série en cours, pour la garder visible. */
const EDITOR_ID = 'saisie-serie';

/** Écran de séance : affiche la séance en cours, ou renvoie à l'accueil s'il n'y en a pas. */
export function SessionPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const loaded = useLive(async () => ({ session: (await getActiveSession()) ?? null }), []);
  // Pendant la clôture, la séance disparaît de « en cours » : on attend la suite sans rediriger.
  const [closing, setClosing] = useState(false);

  const close = async (task: () => Promise<string>) => {
    setClosing(true);
    try {
      navigate(await task(), { replace: true });
    } catch (error) {
      setClosing(false);
      toast(messageOf(error), 'error');
    }
  };

  if (loaded === undefined) return <div className="h-dvh" aria-busy="true" />;
  if (loaded.session === null) {
    return closing ? <div className="h-dvh" aria-busy="true" /> : <Navigate to="/" replace />;
  }

  const sessionId = loaded.session.id;
  return (
    <SessionScreen
      sessionId={sessionId}
      onFinish={() =>
        close(async () => {
          if ((await finishSession(sessionId)) === 'saved') return summaryPath(sessionId);
          toast('Aucune série validée : la séance n’a pas été enregistrée.');
          return '/';
        })
      }
      onAbandon={() =>
        close(async () => {
          await abandonSession(sessionId);
          toast('Séance abandonnée');
          return '/';
        })
      }
    />
  );
}

type Picking = { mode: 'add' } | { mode: 'replace'; sessionExerciseId: string } | null;

function SessionScreen({
  sessionId,
  onFinish,
  onAbandon,
}: {
  sessionId: string;
  onFinish: () => void;
  onAbandon: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const data = useLive(() => getSessionScreenData(sessionId), [sessionId]);
  const settings = useSettings();
  const library = useLive(() => listExercises({ includeArchived: true }), []);
  const stepOf = useMemo(
    () => new Map((library ?? []).map((e) => [e.id, e.weightStep])),
    [library],
  );

  /** Série que l'utilisateur a choisie lui-même ; sinon on suit l'ordre conseillé. */
  const [focusId, setFocusId] = useState<string | null>(null);
  /** Exercice ouvert à la main alors que toutes ses séries sont faites. */
  const [openId, setOpenId] = useState<string | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'finish' | 'abandon' | { removeExercise: string } | null>(null);
  const [replacement, setReplacement] = useState<{ sessionExerciseId: string; exercise: Exercise } | null>(null);

  useWakeLock(true);
  useRestAlarm(
    settings?.restTimer ?? null,
    settings?.soundEnabled ?? false,
    settings?.vibrationEnabled ?? false,
  );

  const flow: FlowExercise[] = useMemo(
    () =>
      (data?.exercises ?? []).map(({ exercise, sets }) => ({
        id: exercise.id,
        supersetGroup: exercise.supersetGroup,
        restSec: exercise.planned?.restSec ?? settings?.defaultRestSec ?? 0,
        sets: sets.map((s) => ({ id: s.id, done: s.done })),
      })),
    [data, settings?.defaultRestSec],
  );

  const allSets = useMemo(() => (data?.exercises ?? []).flatMap((e) => e.sets), [data]);
  const activeSetId =
    focusId !== null && allSets.some((s) => s.id === focusId) ? focusId : nextSetId(flow, null);
  const activeSet = allSets.find((s) => s.id === activeSetId) ?? null;
  const openExerciseId = activeSet?.sessionExerciseId ?? openId;

  // À chaque changement de série ou d'exercice, la zone de saisie reste sous le pouce :
  // l'exercice remonte en haut s'il tient à l'écran, sinon on amène juste la saisie en vue.
  useEffect(() => {
    if (!openExerciseId) return;
    const card = document.getElementById(`exercice-${openExerciseId}`);
    const editor = document.getElementById(EDITOR_ID);
    const viewport = card?.closest('main');
    if (!card || !viewport) return;
    const fits = card.offsetHeight <= viewport.clientHeight;
    if (fits || !editor) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else editor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [openExerciseId, activeSetId]);

  if (!data || !settings) return <div className="h-dvh" aria-busy="true" />;

  const { session, exercises } = data;
  const doneCount = allSets.filter((s) => s.done).length;
  const remaining = allSets.length - doneCount;

  const run = (task: () => Promise<unknown>) => {
    task().catch((error) => toast(messageOf(error), 'error'));
  };

  const validate = (set: SetEntry) => {
    unlockAudio();
    run(async () => {
      const result = await completeSet(set.id);
      setFocusId(result.nextSetId);
      setOpenId(set.sessionExerciseId);
    });
  };

  const openExercise = (item: SessionScreenExercise) => {
    const next = item.sets.find((s) => !s.done);
    setFocusId(next?.id ?? null);
    setOpenId(item.exercise.id);
    // Toutes ses séries sont faites : on montre la dernière, pour pouvoir la corriger.
    if (!next && item.sets.length > 0) setFocusId(item.sets[item.sets.length - 1].id);
  };

  function handlePick(exercise: Exercise) {
    if (picking?.mode === 'replace') {
      const target = exercises.find((e) => e.exercise.id === picking.sessionExerciseId);
      setPicking(null);
      if (!target) return;
      // Exercice venu du programme : on demande si le programme doit changer aussi.
      if (session.workoutId && target.exercise.planned) {
        setReplacement({ sessionExerciseId: target.exercise.id, exercise });
      } else {
        run(() => replaceSessionExercise(target.exercise.id, exercise.id, false));
      }
    } else {
      run(async () => {
        await addSessionExercise(sessionId, exercise.id);
        toast(`Ajouté : ${exercise.name}`);
      });
    }
  }

  const menuTarget = exercises.find((e) => e.exercise.id === menuFor);
  const exerciseMenu: SheetAction[] = menuTarget
    ? [
        {
          label: 'Remplacer par un autre exercice',
          onSelect: () => setPicking({ mode: 'replace', sessionExerciseId: menuTarget.exercise.id }),
        },
        {
          label: 'Retirer de la séance',
          danger: true,
          onSelect: () => {
            if (menuTarget.sets.some((s) => s.done)) {
              setConfirm({ removeExercise: menuTarget.exercise.id });
            } else {
              run(() => removeSessionExercise(menuTarget.exercise.id));
            }
          },
        },
      ]
    : [];

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col">
      <header className="flex items-center gap-2 bg-black/40 px-4 pb-3 backdrop-blur-xl pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <Link
          to="/"
          aria-label="Revenir à l’accueil (la séance continue)"
          className="-ml-3 flex size-12 shrink-0 items-center justify-center rounded-full active:bg-raised"
        >
          <IconChevronLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{session.workoutName}</h1>
          <p className="text-sm text-muted tabular-nums">
            <Chrono startedAt={session.startedAt} /> · {doneCount}/{allSets.length} séries
          </p>
        </div>
        <button
          type="button"
          onClick={() => (remaining === 0 && doneCount > 0 ? onFinish() : setConfirm('finish'))}
          className="min-h-12 shrink-0 rounded-full bg-accent px-5 text-base font-semibold text-accent-ink active:brightness-90"
        >
          Terminer
        </button>
      </header>

      <main className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 pb-8">
        {exercises.length === 0 && (
          <p className="px-2 py-6 text-center text-muted">
            Séance vide pour l’instant. Ajoute ton premier exercice.
          </p>
        )}

        {exercises.map((item) => (
          <ExerciseCard
            key={item.exercise.id}
            item={item}
            open={item.exercise.id === openExerciseId}
            activeSetId={activeSetId}
            weightStep={stepOf.get(item.exercise.exerciseId) ?? settings.weightStep}
            settings={settings}
            onOpen={() => openExercise(item)}
            onFocus={setFocusId}
            onChange={(set, patch) => run(() => updateSet(set.id, patch))}
            onValidate={validate}
            onUnvalidate={(set) => run(() => uncompleteSet(set.id))}
            onAddSet={() =>
              run(async () => {
                const set = await addSet(item.exercise.id);
                setFocusId(set.id);
              })
            }
            onRemoveSet={(set) =>
              run(async () => {
                await removeSet(set.id);
                setFocusId(null);
              })
            }
            onMenu={() => setMenuFor(item.exercise.id)}
            onNote={(note) => run(() => setSessionExerciseNote(item.exercise.id, note))}
          />
        ))}

        <Button onClick={() => setPicking({ mode: 'add' })}>
          <IconPlus />
          Ajouter un exercice
        </Button>

        <NoteField
          key={session.id}
          label="Note de séance (facultatif)"
          placeholder="Ex. bonne forme, épaule un peu raide…"
          initial={session.note}
          onChange={(note) => run(() => setSessionNote(session.id, note))}
        />

        <Button variant="ghost" className="text-danger" onClick={() => setConfirm('abandon')}>
          Abandonner la séance
        </Button>
      </main>

      <RestBar timer={settings.restTimer} />

      <ExercisePicker
        open={picking !== null}
        title={picking?.mode === 'replace' ? 'Remplacer par…' : 'Ajouter un exercice'}
        doneLabel={picking?.mode === 'add' ? 'Terminé' : undefined}
        onPick={handlePick}
        onCreate={(name) =>
          navigate('/reglages/exercices/nouveau', { state: { name, thenAddToSession: sessionId } })
        }
        onClose={() => setPicking(null)}
      />

      <ActionSheet
        open={menuTarget !== undefined}
        title={menuTarget?.exercise.exerciseName ?? ''}
        actions={exerciseMenu}
        onClose={() => setMenuFor(null)}
      />

      <ActionSheet
        open={replacement !== null}
        title={`Remplacer par ${replacement?.exercise.name ?? ''}`}
        actions={[
          {
            label: 'Pour cette séance seulement',
            onSelect: () =>
              replacement &&
              run(() => replaceSessionExercise(replacement.sessionExerciseId, replacement.exercise.id, false)),
          },
          {
            label: 'Aussi dans le programme',
            onSelect: () =>
              replacement &&
              run(async () => {
                await replaceSessionExercise(replacement.sessionExerciseId, replacement.exercise.id, true);
                toast('Programme mis à jour');
              }),
          },
        ]}
        onClose={() => setReplacement(null)}
      />

      <ConfirmDialog
        open={confirm === 'finish'}
        title="Terminer la séance ?"
        confirmLabel="Terminer la séance"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          onFinish();
        }}
      >
        {doneCount === 0 ? (
          <p>Aucune série n’est validée : la séance ne sera pas enregistrée.</p>
        ) : (
          <p>
            Il reste {plural(remaining, 'série non validée', 'séries non validées')}. Seules les
            séries validées seront gardées dans l’historique.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'abandon'}
        title="Abandonner la séance ?"
        confirmLabel="Abandonner et tout effacer"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          onAbandon();
        }}
      >
        <p>
          Tout ce que tu as saisi dans cette séance sera effacé
          {doneCount > 0 ? `, y compris ${plural(doneCount, 'série validée', 'séries validées')}` : ''}.
          Pour garder ce qui est fait, choisis plutôt «&nbsp;Terminer&nbsp;».
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={typeof confirm === 'object' && confirm !== null}
        title="Retirer cet exercice ?"
        confirmLabel="Retirer de la séance"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (typeof confirm === 'object' && confirm !== null) {
            const id = confirm.removeExercise;
            run(() => removeSessionExercise(id));
          }
          setConfirm(null);
        }}
      >
        <p>Ses séries déjà validées dans cette séance seront effacées.</p>
      </ConfirmDialog>
    </div>
  );
}

/** Temps écoulé depuis le début de la séance. */
function Chrono({ startedAt }: { startedAt: number }) {
  const now = useNow(1000);
  return <span>{formatClock((now - startedAt) / 1000)}</span>;
}

// ---------- Un exercice de la séance ----------

function ExerciseCard({
  item,
  open,
  activeSetId,
  weightStep,
  settings,
  onOpen,
  onFocus,
  onChange,
  onValidate,
  onUnvalidate,
  onAddSet,
  onRemoveSet,
  onMenu,
  onNote,
}: {
  item: SessionScreenExercise;
  open: boolean;
  activeSetId: string | null;
  weightStep: number;
  settings: Settings;
  onOpen: () => void;
  onFocus: (setId: string) => void;
  onChange: (set: SetEntry, patch: SetPatch) => void;
  onValidate: (set: SetEntry) => void;
  onUnvalidate: (set: SetEntry) => void;
  onAddSet: () => void;
  onRemoveSet: (set: SetEntry) => void;
  onMenu: () => void;
  onNote: (note: string) => void;
}) {
  const { exercise, sets, history, records } = item;
  const done = sets.filter((s) => s.done).length;
  const complete = sets.length > 0 && done === sets.length;
  const inSuperset = exercise.supersetGroup !== null;
  const frame = `scroll-mt-2 rounded-3xl border bg-surface ${
    inSuperset ? 'border-l-4 border-accent/70' : 'border-line'
  }`;

  if (!open) {
    return (
      <button
        type="button"
        id={`exercice-${exercise.id}`}
        onClick={onOpen}
        className={`${frame} flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-raised`}
      >
        <div className={`min-w-0 flex-1 ${complete ? 'opacity-60' : ''}`}>
          <p className="text-lg font-semibold leading-snug">{exercise.exerciseName}</p>
          {inSuperset && (
            <p className="flex items-center gap-1 text-sm font-semibold text-accent">
              <IconLink className="size-4" /> Superset
            </p>
          )}
        </div>
        <span className="shrink-0 text-base font-semibold tabular-nums text-muted">
          {done}/{sets.length}
        </span>
        {complete && <IconCheck className="shrink-0 text-accent" />}
      </button>
    );
  }

  const activeIndex = sets.findIndex((s) => s.id === activeSetId);
  const active = activeIndex === -1 ? null : sets[activeIndex];
  const lastLifts = history.last?.sets.filter(isCountedSet) ?? [];

  return (
    <section id={`exercice-${exercise.id}`} className={`${frame} space-y-3 p-3`}>
      <div className="flex items-start gap-2 pl-1">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold leading-snug">{exercise.exerciseName}</h2>
          {exercise.planned && <p className="text-sm text-muted">{formatPlanned(exercise.planned)}</p>}
          {exercise.planned?.note && (
            <p className="text-sm text-ink/85">«&nbsp;{exercise.planned.note}&nbsp;»</p>
          )}
          {inSuperset && (
            <p className="flex items-center gap-1 text-sm font-semibold text-accent">
              <IconLink className="size-4" /> Superset
            </p>
          )}
        </div>
        <HeaderButton label={`Actions sur ${exercise.exerciseName}`} onClick={onMenu} />
      </div>

      <p className="rounded-2xl bg-raised px-3 py-2 text-base">
        {history.last && lastLifts.length > 0 ? (
          <>
            <span className="text-muted">
              La dernière fois ({formatShortDate(history.last.date)}) :{' '}
            </span>
            <span className="font-semibold">{formatLifts(lastLifts)}</span>
          </>
        ) : (
          <span className="text-muted">Première fois</span>
        )}
      </p>

      <ul className="space-y-1">
        {sets.map((set, index) => (
          <li key={set.id}>
            <SetRow
              set={set}
              index={index}
              active={set.id === activeSetId}
              records={records.get(set.id)}
              onFocus={() => onFocus(set.id)}
            />
          </li>
        ))}
      </ul>

      {active && (
        <SetEditor
          key={active.id}
          set={active}
          position={`Série ${activeIndex + 1} sur ${sets.length}`}
          weightStep={weightStep}
          repStep={settings.repStep}
          records={records.get(active.id)}
          canRemove={sets.length > 1}
          onChange={(patch) => onChange(active, patch)}
          onValidate={() => onValidate(active)}
          onUnvalidate={() => onUnvalidate(active)}
          onRemove={() => onRemoveSet(active)}
        />
      )}

      <Button onClick={onAddSet} className="min-h-12 text-base">
        <IconPlus />
        Ajouter une série
      </Button>

      <NoteField
        key={exercise.id}
        label="Note sur cet exercice (facultatif)"
        placeholder="Ex. prise plus large aujourd’hui"
        initial={exercise.note}
        onChange={onNote}
      />
    </section>
  );
}

const SHORT_TYPE: Record<SetType, string | null> = {
  normal: null,
  warmup: 'Échauff.',
  drop: 'Drop set',
  superset: 'Superset',
  biset: 'Bi-set',
  failure: 'Échec',
};

function RecordBadge({ kinds }: { kinds: RecordKind[] }) {
  return (
    <span
      className="shrink-0 rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-black"
      title={kinds.map((k) => RECORD_LABELS[k]).join(', ')}
    >
      Record
    </span>
  );
}

/** Une série, en une ligne. La toucher l'ouvre dans la zone de saisie. */
function SetRow({
  set,
  index,
  active,
  records,
  onFocus,
}: {
  set: SetEntry;
  index: number;
  active: boolean;
  records: RecordKind[] | undefined;
  onFocus: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFocus}
      aria-current={active ? 'true' : undefined}
      className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3 text-left ${
        active ? 'border-accent bg-raised' : 'border-transparent active:bg-raised'
      }`}
    >
      <span className="w-5 shrink-0 text-center text-base font-semibold tabular-nums text-muted">
        {index + 1}
      </span>
      <span
        className={`min-w-0 flex-1 text-lg tabular-nums ${set.done ? 'font-semibold text-ink' : 'text-muted'}`}
      >
        {formatSet(set)}
        {set.rpe !== null && <span className="text-sm text-muted"> · RPE {formatNumber(set.rpe)}</span>}
      </span>
      {SHORT_TYPE[set.type] && (
        <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-xs font-semibold text-muted">
          {SHORT_TYPE[set.type]}
        </span>
      )}
      {records && <RecordBadge kinds={records} />}
      {set.done && <IconCheck className="shrink-0 text-accent" aria-label="Validée" />}
    </button>
  );
}

// ---------- Saisie d'une série ----------

function SetEditor({
  set,
  position,
  weightStep,
  repStep,
  records,
  canRemove,
  onChange,
  onValidate,
  onUnvalidate,
  onRemove,
}: {
  set: SetEntry;
  position: string;
  weightStep: number;
  repStep: number;
  records: RecordKind[] | undefined;
  canRemove: boolean;
  onChange: (patch: SetPatch) => void;
  onValidate: () => void;
  onUnvalidate: () => void;
  onRemove: () => void;
}) {
  return (
    <div id={EDITOR_ID} className="scroll-mb-2 space-y-3 rounded-2xl border border-line bg-black/30 p-3">
      <p className="font-semibold">{position}</p>

      {/* Type de série : un appui suffit pour noter un drop set, un superset ou un bi-set. */}
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Type de série"
      >
        {(Object.keys(SET_TYPE_LABELS) as SetType[]).map((type) => (
          <Chip key={type} selected={set.type === type} onClick={() => onChange({ type })}>
            {SET_TYPE_LABELS[type]}
          </Chip>
        ))}
      </div>

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

      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm font-semibold text-muted">RPE</span>
        <div className="no-scrollbar -mr-3 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-3">
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

      {set.done ? (
        <>
          <p className="flex items-center justify-center gap-2 text-center font-semibold text-accent">
            <IconCheck /> Série validée
            {records && <RecordBadge kinds={records} />}
          </p>
          {records && (
            <p className="text-center text-sm text-gold">
              {records.map((kind) => RECORD_LABELS[kind]).join(' · ')}
            </p>
          )}
          <Button onClick={onUnvalidate} className="min-h-12 text-base">
            Annuler la validation
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="primary"
            onClick={onValidate}
            disabled={set.weight === null}
            className="min-h-18 text-2xl"
          >
            <IconCheck />
            Valider
          </Button>
          {set.weight === null && (
            <p className="text-center text-sm text-gold">
              Indique la charge
            </p>
          )}
        </>
      )}

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="mx-auto block min-h-11 px-4 text-sm font-semibold text-muted underline underline-offset-4 active:text-ink"
        >
          Retirer cette série
        </button>
      )}
    </div>
  );
}

/** Gros boutons − et + ; toucher la valeur permet de la taper au clavier. */
export function BigStepper({
  label,
  unit,
  value,
  step,
  min,
  max,
  integer = false,
  onChange,
}: {
  label: string;
  unit: string;
  value: number | null;
  step: number;
  min: number;
  max: number;
  integer?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const round = (n: number) => Math.round(n * 100) / 100;
  const button =
    'flex h-16 w-18 shrink-0 items-center justify-center rounded-2xl border border-line bg-raised text-ink select-none active:bg-line disabled:opacity-35';

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft.trim().replace(',', '.'));
    if (draft.trim() !== '' && Number.isFinite(parsed)) {
      onChange(Math.min(max, Math.max(min, integer ? Math.round(parsed) : parsed)));
    }
    setDraft(null);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, round((value ?? 0) - step)))}
        disabled={value === null || value <= min}
        aria-label={`${label} : diminuer de ${formatNumber(step)}`}
        className={button}
      >
        <IconMinus className="size-7" />
      </button>

      {draft === null ? (
        <button
          type="button"
          onClick={() => setDraft(value === null ? '' : formatNumber(value))}
          aria-label={`${label} : ${value === null ? 'à saisir' : `${formatNumber(value)} ${unit}`}. Toucher pour taper la valeur.`}
          className="flex h-16 min-w-0 flex-1 flex-col items-center justify-center rounded-2xl active:bg-raised"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
          <span className="text-3xl font-bold leading-none tabular-nums">
            {value === null ? '—' : formatNumber(value)}
            <span className="ml-1 text-base font-semibold text-muted">{unit}</span>
          </span>
        </button>
      ) : (
        <input
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          value={draft}
          autoFocus
          onFocus={(event) => event.target.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          aria-label={`${label}, en ${unit}`}
          enterKeyHint="done"
          autoComplete="off"
          className="h-16 min-w-0 flex-1 rounded-2xl border border-accent bg-black/40 text-center text-3xl font-bold tabular-nums text-ink outline-none"
        />
      )}

      <button
        type="button"
        onClick={() => onChange(Math.min(max, round((value ?? 0) + step)))}
        disabled={value !== null && value >= max}
        aria-label={`${label} : augmenter de ${formatNumber(step)}`}
        className={button}
      >
        <IconPlus className="size-7" />
      </button>
    </div>
  );
}

/** Champ de note : enregistré à chaque frappe. */
function NoteField({
  label,
  placeholder,
  initial,
  onChange,
}: {
  label: string;
  placeholder: string;
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
      placeholder={`${label} · ${placeholder}`}
      maxLength={300}
      autoComplete="off"
      autoCapitalize="sentences"
      enterKeyHint="done"
      className="h-13 w-full rounded-2xl border border-line bg-black/30 px-4 text-ink outline-none placeholder:text-muted focus:border-accent"
    />
  );
}

// ---------- Minuteur de repos ----------

function RestBar({ timer }: { timer: RestTimer | null }) {
  const now = useNow(250);
  if (!timer) return null;

  const remaining = Math.ceil((timer.endsAt - now) / 1000);
  const over = remaining <= 0;
  const sinceEnd = Math.floor((now - timer.endsAt) / 1000);
  const progress = timer.totalSec > 0 ? Math.min(1, Math.max(0, remaining / timer.totalSec)) : 0;
  const small =
    'flex h-14 min-w-14 shrink-0 items-center justify-center rounded-2xl border px-3 text-base font-semibold select-none';

  return (
    <div
      role="timer"
      aria-label="Minuteur de repos"
      className={`border-t px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] ${
        over
          ? `border-accent bg-accent text-accent-ink ${sinceEnd < 6 ? 'animate-pulse' : ''}`
          : 'glass border-x-0 border-b-0'
      }`}
    >
      {!over && (
        <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-raised">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider">
            {over ? 'Repos terminé, c’est reparti' : 'Repos'}
          </p>
          <p className="text-4xl font-bold leading-none tabular-nums">
            {over ? `+${formatClock(sinceEnd)}` : formatClock(remaining)}
          </p>
        </div>
        {!over && (
          <>
            <button
              type="button"
              onClick={() => void adjustRest(-15)}
              aria-label="Retirer 15 secondes"
              className={`${small} border-line bg-raised active:bg-line`}
            >
              −15
            </button>
            <button
              type="button"
              onClick={() => void adjustRest(15)}
              aria-label="Ajouter 15 secondes"
              className={`${small} border-line bg-raised active:bg-line`}
            >
              +15
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => void clearRest()}
          className={`${small} ${
            over ? 'border-accent-ink/40 bg-accent-ink text-accent' : 'border-line bg-raised active:bg-line'
          }`}
        >
          {over ? 'Fermer' : 'Passer'}
        </button>
      </div>
    </div>
  );
}
