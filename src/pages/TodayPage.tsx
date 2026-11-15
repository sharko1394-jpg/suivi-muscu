import { Link } from 'react-router';
import { BACKUP_REMINDER_DAYS, snoozeBackupReminder, useBackupDue } from '../data';
import { Button, Card, PageHeader, buttonClass } from '../ui/components';
import { formatLongDay } from '../ui/format';
import { IconShare } from '../ui/icons';
import { isIOS, isStandalone } from '../ui/platform';

export function TodayPage() {
  const backupDue = useBackupDue();
  const showInstallHint = !isStandalone();

  return (
    <>
      <PageHeader title="Aujourd’hui" subtitle={formatLongDay(Date.now())} />
      <div className="space-y-4 p-4">
        {backupDue && <BackupReminder />}

        <Card className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            En construction · étape 1 sur 6
          </p>
          <p className="text-lg">
            Les fondations sont posées : tes données sont enregistrées sur ce téléphone et tu peux
            les sauvegarder.
          </p>
          <p className="text-muted">
            La séance du jour arrivera ici à l’étape 3. En attendant, tu peux parcourir la
            bibliothèque d’exercices et y ajouter les tiens.
          </p>
          <Link to="/reglages/exercices" className={buttonClass('primary')}>
            Voir les exercices
          </Link>
        </Card>

        {showInstallHint && <InstallHint />}
      </div>
    </>
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
