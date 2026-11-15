import { useRef, useState, type ChangeEvent } from 'react';
import {
  BACKUP_REMINDER_DAYS,
  CURRENT_VERSION,
  backupFileName,
  backupToCurrentData,
  buildHistoryCsv,
  countsFromDump,
  csvFileName,
  exportBackup,
  importBackup,
  markBackupDone,
  parseBackup,
  requestPersistence,
  useBackupDue,
  useDataCounts,
  useSettings,
  useStorageInfo,
  type BackupFile,
  type DataCounts,
} from '../data';
import { Button, Card, ConfirmDialog, LinkRow, PageHeader, Section } from '../ui/components';
import {
  describeCounts,
  formatAgo,
  formatBytes,
  formatDateTime,
  messageOf,
  plural,
} from '../ui/format';
import { isIOS, isStandalone, saveFile } from '../ui/platform';
import { useToast } from '../ui/toast';

type Delivery = { file: File; kind: 'backup' | 'csv' };

export function SettingsPage() {
  const settings = useSettings();
  const counts = useDataCounts();
  const backupDue = useBackupDue();
  const [storage, refreshStorage] = useStorageInfo();
  const toast = useToast();

  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [waitingTap, setWaitingTap] = useState<Delivery | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    backup: BackupFile;
    counts: DataCounts;
  } | null>(null);

  // ----- Export -----

  async function deliver(delivery: Delivery) {
    const result = await saveFile(delivery.file);
    if (result === 'needs-gesture') {
      setWaitingTap(delivery);
      return;
    }
    setWaitingTap(null);
    if (result === 'cancelled') return;
    if (delivery.kind === 'backup') await markBackupDone();
    toast(delivery.kind === 'backup' ? 'Sauvegarde enregistrée' : 'Historique exporté');
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      toast(messageOf(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  const handleExport = () =>
    run(async () => {
      const backup = await exportBackup(__APP_VERSION__);
      const file = new File([JSON.stringify(backup)], backupFileName(), {
        type: 'application/json',
      });
      await deliver({ file, kind: 'backup' });
    });

  const handleCsv = () =>
    run(async () => {
      const file = new File([await buildHistoryCsv()], csvFileName(), { type: 'text/csv' });
      await deliver({ file, kind: 'csv' });
    });

  // ----- Import -----

  const handleFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void run(async () => {
      const backup = parseBackup(await file.text());
      setPendingImport({ backup, counts: countsFromDump(backupToCurrentData(backup)) });
    });
  };

  const confirmImport = () =>
    run(async () => {
      if (!pendingImport) return;
      try {
        await importBackup(pendingImport.backup);
        toast('Données restaurées');
      } finally {
        setPendingImport(null);
      }
    });

  // ----- Protection du stockage -----

  const askPersistence = () =>
    run(async () => {
      const state = await requestPersistence();
      refreshStorage();
      if (state === 'persisted') toast('Stockage protégé');
      else toast('Le téléphone n’a pas accordé la protection pour l’instant.', 'error');
    });

  const lastBackup = settings?.lastBackupAt ?? null;

  return (
    <>
      <PageHeader title="Réglages" />
      <div className="space-y-8 p-4 pb-8">
        <Section title="Sauvegarde">
          <Card className="space-y-4">
            <div>
              <p className="text-lg font-semibold">
                {lastBackup === null
                  ? 'Aucune sauvegarde pour l’instant'
                  : `Dernière sauvegarde : ${formatAgo(lastBackup)}`}
              </p>
              {lastBackup !== null && (
                <p className="text-sm text-muted">{formatDateTime(lastBackup)}</p>
              )}
              {backupDue && (
                <p className="mt-1 font-medium text-gold">
                  Plus de {BACKUP_REMINDER_DAYS} jours sans sauvegarde : pense à en refaire une.
                </p>
              )}
            </div>

            <Button variant="primary" onClick={handleExport} disabled={busy}>
              Sauvegarder mes données
            </Button>
            <Button onClick={() => fileInput.current?.click()} disabled={busy}>
              Restaurer une sauvegarde
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFileChosen}
            />

            <p className="text-sm text-muted">
              La sauvegarde est un fichier qui contient toutes tes données. Range-le ailleurs que
              sur ce téléphone (iCloud Drive, e-mail à toi-même…).
            </p>
          </Card>

          <Card className="space-y-3">
            <Button onClick={handleCsv} disabled={busy || !counts || counts.sessions === 0}>
              Exporter l’historique (CSV)
            </Button>
            <p className="text-sm text-muted">
              {counts && counts.sessions === 0
                ? 'Disponible dès ta première séance terminée. '
                : ''}
              Un tableau de toutes tes séries, à ouvrir dans Excel ou Numbers. Il ne remplace pas
              la sauvegarde.
            </p>
          </Card>
        </Section>

        <Section title="Bibliothèque">
          <LinkRow
            to="/reglages/exercices"
            title="Exercices"
            detail={
              counts
                ? `${plural(counts.exercises, 'exercice')}, dont ${counts.customExercises} créé${counts.customExercises > 1 ? 's' : ''} par toi`
                : undefined
            }
          />
        </Section>

        <Section title="Mes données">
          <Card className="space-y-3">
            <Info label="Sur ce téléphone" value={counts ? describeCounts(counts) : '…'} />
            {storage?.usage != null && (
              <Info label="Espace utilisé" value={formatBytes(storage.usage)} />
            )}
            <Info
              label="Protection contre l’effacement automatique"
              value={
                storage === undefined
                  ? '…'
                  : storage.state === 'persisted'
                    ? 'Activée'
                    : storage.state === 'not-persisted'
                      ? 'Pas encore accordée'
                      : 'Non proposée par ce navigateur'
              }
              tone={storage?.state === 'persisted' ? 'good' : storage ? 'warn' : undefined}
            />
            {storage?.state === 'not-persisted' && (
              <>
                <p className="text-sm text-muted">
                  {isIOS() && !isStandalone()
                    ? 'Installe l’appli sur l’écran d’accueil : l’iPhone protège alors ses données.'
                    : 'Le téléphone l’accorde en général une fois l’appli installée et utilisée régulièrement.'}
                </p>
                <Button onClick={askPersistence} disabled={busy}>
                  Redemander
                </Button>
              </>
            )}
          </Card>
        </Section>

        <Section title="À propos">
          <Card className="space-y-3">
            <Info
              label="Version de l’appli"
              value={`${__APP_VERSION__} · ${formatDateTime(Date.parse(__BUILD_TIME__))}`}
            />
            <Info label="Format des données" value={`Version ${CURRENT_VERSION}`} />
            <p className="text-sm text-muted">
              Aucun compte, aucun serveur : tes données ne quittent jamais ce téléphone, sauf dans
              les fichiers que tu exportes toi-même.
            </p>
          </Card>
        </Section>
      </div>

      <ConfirmDialog
        open={waitingTap !== null}
        title={waitingTap?.kind === 'backup' ? 'Sauvegarde prête' : 'Export prêt'}
        confirmLabel="Enregistrer le fichier"
        busy={busy}
        onConfirm={() => waitingTap && void run(() => deliver(waitingTap))}
        onCancel={() => setWaitingTap(null)}
      >
        <p>
          Choisis ensuite «&nbsp;Enregistrer dans Fichiers&nbsp;» ou envoie-le où tu veux.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingImport !== null}
        title="Remplacer toutes mes données ?"
        confirmLabel="Remplacer mes données"
        danger
        busy={busy}
        onConfirm={confirmImport}
        onCancel={() => setPendingImport(null)}
      >
        {pendingImport && (
          <>
            <p>
              <strong className="text-ink">Dans le fichier</strong> (sauvegarde du{' '}
              {formatDateTime(Date.parse(pendingImport.backup.exportedAt))}) :{' '}
              {describeCounts(pendingImport.counts)}.
            </p>
            <p>
              <strong className="text-ink">Sur ce téléphone</strong> :{' '}
              {counts ? describeCounts(counts) : '…'}.
            </p>
            <p>
              Tout ce qui est sur ce téléphone sera remplacé par le contenu du fichier. Cette
              action est définitive.
            </p>
          </>
        )}
      </ConfirmDialog>
    </>
  );
}

function Info({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warn';
}) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`text-lg font-medium ${
          tone === 'good' ? 'text-accent' : tone === 'warn' ? 'text-gold' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
