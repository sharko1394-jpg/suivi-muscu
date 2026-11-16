import { useRef, useState, type ChangeEvent } from 'react';
import {
  BACKUP_REMINDER_DAYS,
  CURRENT_VERSION,
  WEIGHT_STEPS,
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
  setSetting,
  useBackupDue,
  useDataCounts,
  useSettings,
  useStorageInfo,
  type BackupFile,
  type DataCounts,
} from '../data';
import { Button, Card, ConfirmDialog, LinkRow, PageHeader, Section } from '../ui/components';
import { Stepper, Switch } from '../ui/controls';
import {
  describeCounts,
  formatAgo,
  formatBytes,
  formatDateTime,
  formatNumber,
  formatRest,
  messageOf,
  plural,
} from '../ui/format';
import { saveFile } from '../ui/platform';
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

  /**
   * Demande tout de suite s'il existe une version plus récente, sans attendre la vérification
   * automatique. Si oui, le bandeau « Mise à jour disponible » apparaît. Les données ne sont pas touchées.
   */
  const checkForUpdate = () =>
    run(async () => {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (!registration) {
        toast('La recherche de mise à jour n’est possible que sur l’appli en ligne.', 'error');
        return;
      }
      try {
        await registration.update();
      } catch {
        toast('Impossible de vérifier : pas de réseau pour l’instant.', 'error');
        return;
      }
      if (registration.installing || registration.waiting) {
        toast('Mise à jour trouvée : le bandeau va apparaître en bas de l’écran.');
      } else {
        toast('Tu as déjà la dernière version.');
      }
    });

  /** Passe au pas de charge précédent ou suivant dans la liste proposée. */
  const stepWeight = (direction: 1 | -1) => {
    if (!settings) return;
    const current = WEIGHT_STEPS.reduce((best, step, index) =>
      Math.abs(step - settings.weightStep) < Math.abs(WEIGHT_STEPS[best] - settings.weightStep)
        ? index
        : best,
    0);
    const next = WEIGHT_STEPS[Math.min(WEIGHT_STEPS.length - 1, Math.max(0, current + direction))];
    void setSetting('weightStep', next);
  };

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

          </Card>

          <Card className="space-y-3">
            <Button onClick={handleCsv} disabled={busy || !counts || counts.sessions === 0}>
              Exporter l’historique (CSV)
            </Button>
          </Card>
        </Section>

        {settings && (
          <Section title="Séance">
            <Card className="space-y-5">
              <Stepper
                label="Pas de charge"
                value={`${formatNumber(settings.weightStep)} kg`}
                onDecrement={() => stepWeight(-1)}
                onIncrement={() => stepWeight(1)}
                canDecrement={settings.weightStep > WEIGHT_STEPS[0]}
                canIncrement={settings.weightStep < WEIGHT_STEPS[WEIGHT_STEPS.length - 1]}
              />
              <Stepper
                label="Pas de répétitions"
                value={String(settings.repStep)}
                onDecrement={() => void setSetting('repStep', settings.repStep - 1)}
                onIncrement={() => void setSetting('repStep', settings.repStep + 1)}
                canDecrement={settings.repStep > 1}
                canIncrement={settings.repStep < 5}
              />
              <Stepper
                label="Repos par défaut"
                value={settings.defaultRestSec === 0 ? 'aucun' : formatRest(settings.defaultRestSec)}
                onDecrement={() => void setSetting('defaultRestSec', settings.defaultRestSec - 15)}
                onIncrement={() => void setSetting('defaultRestSec', settings.defaultRestSec + 15)}
                canDecrement={settings.defaultRestSec > 0}
                canIncrement={settings.defaultRestSec < 900}
              />
              <Switch
                label="Son à la fin du repos"
                checked={settings.soundEnabled}
                onChange={(checked) => void setSetting('soundEnabled', checked)}
              />
              {'vibrate' in navigator && (
                <Switch
                  label="Vibration à la fin du repos"
                  checked={settings.vibrationEnabled}
                  onChange={(checked) => void setSetting('vibrationEnabled', checked)}
                />
              )}
            </Card>
          </Section>
        )}

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
            <Button onClick={checkForUpdate} disabled={busy}>
              Rechercher une mise à jour
            </Button>
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
