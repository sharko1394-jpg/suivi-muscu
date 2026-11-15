import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  BACKUP_REMINDER_DAYS,
  getActiveProgram,
  listExercises,
  listWorkouts,
  plannedWorkoutFor,
  snoozeBackupReminder,
  useBackupDue,
  useLive,
  type Program,
  type TodayPlan,
} from '../data';
import { Button, Card, PageHeader, buttonClass } from '../ui/components';
import { formatLongDay, formatPlanned, plural } from '../ui/format';
import { IconShare } from '../ui/icons';
import { isIOS, isStandalone } from '../ui/platform';
import { PROGRAM_LIST, programPath, workoutPath } from './ProgramListPage';

export function TodayPage() {
  const backupDue = useBackupDue();
  const showInstallHint = !isStandalone();
  const today = useLive(async () => {
    const program = await getActiveProgram();
    const workouts = program ? await listWorkouts(program.id) : [];
    return { program: program ?? null, plan: plannedWorkoutFor(program, workouts, new Date()) };
  }, []);

  return (
    <>
      <PageHeader title="Aujourd’hui" subtitle={formatLongDay(Date.now())} />
      <div className="space-y-4 p-4">
        {backupDue && <BackupReminder />}
        {today && <PlanCard program={today.program} plan={today.plan} />}
        <Card className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            En construction · étape 2 sur 6
          </p>
          <p className="text-muted">
            Tu peux maintenant préparer ton programme. Le bouton «&nbsp;Démarrer&nbsp;» et la
            saisie des séries arrivent à l’étape 3.
          </p>
        </Card>
        {showInstallHint && <InstallHint />}
      </div>
    </>
  );
}

/** Ce que le programme actif prévoit aujourd'hui. */
function PlanCard({ program, plan }: { program: Program | null; plan: TodayPlan }) {
  const exercises = useLive(() => listExercises({ includeArchived: true }), []);
  const names = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e.name])), [exercises]);

  if (program === null) {
    return (
      <Card className="space-y-3">
        <p className="text-lg font-semibold">Aucun programme actif</p>
        <p className="text-muted">
          Crée ton programme pour que l’appli te propose chaque jour la bonne séance.
        </p>
        <Link to={PROGRAM_LIST} className={buttonClass('primary')}>
          Préparer mon programme
        </Link>
      </Card>
    );
  }

  if (plan.kind === 'none') {
    return (
      <Card className="space-y-3">
        <p className="text-lg font-semibold">{program.name}</p>
        <p className="text-muted">Ce programme n’a pas encore de séance.</p>
        <Link to={programPath(program.id)} className={buttonClass('primary')}>
          Ajouter une séance
        </Link>
      </Card>
    );
  }

  if (plan.kind === 'rest') {
    return (
      <Card className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted">{program.name}</p>
        <p className="text-2xl font-bold">Repos aujourd’hui</p>
        <p className="text-muted">Aucune séance n’est prévue ce jour-là dans ton programme.</p>
      </Card>
    );
  }

  const { workout } = plan;
  return (
    <Card className="space-y-3">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-muted">
          {program.scheduleMode === 'rotation' ? 'Prochaine séance' : 'Séance du jour'} ·{' '}
          {program.name}
        </p>
        <p className="text-3xl font-bold leading-tight">{workout.name}</p>
        <p className="text-muted">{plural(workout.items.length, 'exercice')}</p>
      </div>
      {workout.items.length > 0 && (
        <ul className="space-y-1.5 border-t border-line/60 pt-3">
          {workout.items.map((item) => (
            <li key={item.id}>
              <p className="font-medium leading-snug">
                {names.get(item.exerciseId) ?? 'Exercice supprimé'}
              </p>
              <p className="text-sm text-muted">{formatPlanned(item)}</p>
            </li>
          ))}
        </ul>
      )}
      <Link to={workoutPath(program.id, workout.id)} className={buttonClass('secondary')}>
        Modifier cette séance
      </Link>
    </Card>
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
