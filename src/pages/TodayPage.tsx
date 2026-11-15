import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  BACKUP_REMINDER_DAYS,
  getTodayState,
  listExercises,
  localDate,
  skipPlannedWorkout,
  snoozeBackupReminder,
  startSession,
  unskipToday,
  useBackupDue,
  useLive,
  type ProgramWorkout,
  type TodayState,
} from '../data';
import { Button, Card, PageHeader, buttonClass } from '../ui/components';
import { formatDuration, formatLongDay, formatPlanned, messageOf, plural } from '../ui/format';
import { useNow } from '../ui/hooks';
import { IconCheck, IconChevronRight, IconShare } from '../ui/icons';
import { ActionSheet, type SheetAction } from '../ui/overlays';
import { isIOS, isStandalone } from '../ui/platform';
import { unlockAudio } from '../ui/sound';
import { useToast } from '../ui/toast';
import { PROGRAM_LIST, programPath } from './ProgramListPage';
import { SESSION_PATH, summaryPath } from './SessionPage';

export function TodayPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const backupDue = useBackupDue();
  const now = useNow(60_000);
  // Relu à chaque changement de données, et au passage de minuit.
  const state = useLive(() => getTodayState(), [localDate(now)]);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = (task: () => Promise<unknown>) => {
    task().catch((error) => toast(messageOf(error), 'error'));
  };

  /** Démarre une séance du programme, ou une séance libre si `workoutId` est null. */
  const start = (workoutId: string | null) => {
    unlockAudio(); // l'appui autorise le son du minuteur pour toute la séance
    setBusy(true);
    startSession(workoutId).then(
      () => navigate(SESSION_PATH),
      (error) => {
        setBusy(false);
        toast(messageOf(error), 'error');
      },
    );
  };

  const plannedId = state?.plan.kind === 'workout' ? state.plan.workout.id : null;
  const otherWorkouts: SheetAction[] = [
    ...(state?.workouts ?? [])
      .filter((workout) => workout.id !== plannedId)
      .map((workout) => ({ label: workout.name, onSelect: () => start(workout.id) })),
    { label: 'Séance libre', onSelect: () => start(null) },
  ];

  return (
    <>
      <PageHeader title="Aujourd’hui" subtitle={formatLongDay(now)} />
      <div className="space-y-4 p-4 pb-8">
        {backupDue && <BackupReminder />}

        {state?.active && <ActiveCard active={state.active} now={now} />}

        {state && !state.active && (
          <PlanCard
            state={state}
            busy={busy}
            onStart={start}
            onChoose={() => setChoosing(true)}
            onSkip={() => run(() => skipPlannedWorkout())}
            onUnskip={() => run(() => unskipToday())}
          />
        )}

        {state && state.doneToday.length > 0 && (
          <Card className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted">
              Fait aujourd’hui
            </p>
            {state.doneToday.map((session) => (
              <Link
                key={session.id}
                to={summaryPath(session.id)}
                className="-mx-2 flex min-h-13 items-center gap-3 rounded-2xl px-2 active:bg-raised"
              >
                <IconCheck className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold">{session.workoutName}</span>
                  <span className="block text-sm text-muted">
                    {formatDuration(((session.endedAt ?? session.startedAt) - session.startedAt) / 1000)} ·
                    voir le bilan
                  </span>
                </span>
                <IconChevronRight className="shrink-0 text-muted" />
              </Link>
            ))}
          </Card>
        )}

        {!isStandalone() && <InstallHint />}
      </div>

      <ActionSheet
        open={choosing}
        title="Quelle séance ?"
        actions={otherWorkouts}
        onClose={() => setChoosing(false)}
      />
    </>
  );
}

/** Une séance est en cours : on la reprend en un appui. */
function ActiveCard({ active, now }: { active: NonNullable<TodayState['active']>; now: number }) {
  const { session, doneSets, totalSets } = active;
  return (
    <Card className="space-y-3 border-accent/70">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">Séance en cours</p>
        <p className="text-3xl font-bold leading-tight">{session.workoutName}</p>
        <p className="text-muted">
          {doneSets}/{totalSets} séries · commencée il y a {formatDuration((now - session.startedAt) / 1000)}
        </p>
      </div>
      <Link
        to={SESSION_PATH}
        onClick={unlockAudio}
        className={`${buttonClass('primary')} min-h-20 text-3xl`}
      >
        Reprendre
      </Link>
    </Card>
  );
}

/** Ce que le programme prévoit aujourd'hui, avec le bouton « Démarrer ». */
function PlanCard({
  state,
  busy,
  onStart,
  onChoose,
  onSkip,
  onUnskip,
}: {
  state: TodayState;
  busy: boolean;
  onStart: (workoutId: string | null) => void;
  onChoose: () => void;
  onSkip: () => void;
  onUnskip: () => void;
}) {
  const { program, plan, workouts } = state;

  const freeButton = (
    <Button onClick={() => onStart(null)} disabled={busy} className="min-h-12 text-base">
      Séance libre
    </Button>
  );
  const chooseButton = workouts.length > 0 && (
    <Button onClick={onChoose} disabled={busy} className="min-h-12 text-base">
      {plan.kind === 'workout' ? 'Autre séance' : 'Choisir une séance'}
    </Button>
  );

  if (program === null) {
    return (
      <Card className="space-y-3">
        <p className="text-lg font-semibold">Aucun programme actif</p>
        <p className="text-muted">
          Prépare ton programme pour que l’appli te propose chaque jour la bonne séance, ou lance
          une séance libre tout de suite.
        </p>
        <Link to={PROGRAM_LIST} className={buttonClass('primary')}>
          Préparer mon programme
        </Link>
        {freeButton}
      </Card>
    );
  }

  if (plan.kind === 'none') {
    return (
      <Card className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted">{program.name}</p>
        <p className="text-muted">Ce programme n’a pas encore de séance.</p>
        <Link to={programPath(program.id)} className={buttonClass('primary')}>
          Ajouter une séance
        </Link>
        {freeButton}
      </Card>
    );
  }

  if (plan.kind === 'rest') {
    return (
      <Card className="space-y-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-muted">{program.name}</p>
          <p className="text-3xl font-bold leading-tight">Repos aujourd’hui</p>
          <p className="text-muted">Aucune séance n’est prévue ce jour-là.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {chooseButton}
          {freeButton}
        </div>
      </Card>
    );
  }

  const { workout } = plan;
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-muted">
          {program.scheduleMode === 'rotation' ? 'Prochaine séance' : 'Séance du jour'} · {program.name}
        </p>
        <p className="text-3xl font-bold leading-tight">{workout.name}</p>
      </div>

      {state.plannedDone ? (
        <p className="flex items-center gap-2 rounded-2xl bg-accent/10 px-4 py-3 font-semibold text-accent">
          <IconCheck /> Séance du jour faite
        </p>
      ) : state.skipped ? (
        <>
          <p className="rounded-2xl bg-raised px-4 py-3 text-muted">Tu as passé cette séance aujourd’hui.</p>
          <Button onClick={onUnskip}>Finalement, je la fais</Button>
        </>
      ) : (
        <>
          <WorkoutPreview workout={workout} />
          <Button
            variant="primary"
            onClick={() => onStart(workout.id)}
            disabled={busy}
            className="min-h-20 text-3xl"
          >
            Démarrer
          </Button>
        </>
      )}

      <div className={`grid gap-2 ${state.plannedDone || state.skipped ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {chooseButton}
        {!state.plannedDone && !state.skipped && (
          <Button onClick={onSkip} disabled={busy} className="min-h-12 text-base">
            Passer
          </Button>
        )}
        {freeButton}
      </div>
    </Card>
  );
}

function WorkoutPreview({ workout }: { workout: ProgramWorkout }) {
  const exercises = useLive(() => listExercises({ includeArchived: true }), []);
  const names = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e.name])), [exercises]);

  if (workout.items.length === 0) {
    return <p className="text-muted">Cette séance est vide : tu ajouteras les exercices en route.</p>;
  }
  return (
    <ul className="space-y-1.5 border-t border-line/60 pt-3">
      {workout.items.map((item) => (
        <li key={item.id} className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate font-medium">
            {names.get(item.exerciseId) ?? 'Exercice supprimé'}
          </span>
          <span className="shrink-0 text-sm text-muted tabular-nums">
            {formatPlanned({ ...item, targetWeight: null }).split(' · ')[0]}
          </span>
        </li>
      ))}
      <li className="pt-1 text-sm text-muted">{plural(workout.items.length, 'exercice')}</li>
    </ul>
  );
}

/** Rappel discret : la dernière sauvegarde est trop ancienne. */
function BackupReminder() {
  return (
    <Card className="space-y-3 border-gold/50">
      <p className="text-lg font-semibold">
        Ta dernière sauvegarde date de plus de {BACKUP_REMINDER_DAYS} jours
      </p>
      <p className="text-muted">Un fichier de sauvegarde te protège si tu perds ton téléphone.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => void snoozeBackupReminder()}>
          Plus tard
        </Button>
        <Link to="/reglages" className={buttonClass('secondary')}>
          Sauvegarder
        </Link>
      </div>
    </Card>
  );
}

/** Affiché tant que l'appli tourne dans un onglet du navigateur. */
function InstallHint() {
  return (
    <Card className="space-y-2">
      <p className="text-lg font-semibold">Installe l’appli sur ton écran d’accueil</p>
      {isIOS() ? (
        <p className="text-muted">
          Dans Safari, touche le bouton Partager{' '}
          <IconShare className="inline size-5 align-text-bottom text-ink" />, puis «&nbsp;Sur
          l’écran d’accueil&nbsp;».
        </p>
      ) : (
        <p className="text-muted">
          Ouvre le menu de ton navigateur, puis choisis «&nbsp;Installer l’application&nbsp;» ou
          «&nbsp;Ajouter à l’écran d’accueil&nbsp;».
        </p>
      )}
      <p className="text-muted">
        Fais-le avant d’enregistrer quoi que ce soit : l’appli installée garde ses données à part
        de celles du navigateur.
      </p>
    </Card>
  );
}
