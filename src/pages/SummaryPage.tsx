import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  RECORD_LABELS,
  deleteSession,
  getSessionSummary,
  isCountedSet,
  setSessionNote,
  useLive,
  type SessionSummary,
} from '../data';
import { Card, ConfirmDialog, PageHeader, Section, StatTile, buttonClass } from '../ui/components';
import { HeaderButton } from '../ui/controls';
import {
  formatDuration,
  formatLifts,
  formatLoad,
  formatLongDay,
  formatShortDate,
  formatVolume,
  messageOf,
  plural,
} from '../ui/format';
import { ActionSheet } from '../ui/overlays';
import { useToast } from '../ui/toast';

export const editPath = (sessionId: string) => `/bilan/${sessionId}/corriger`;

/** Bilan d'une séance terminée : durée, volume, records, comparaison avec la fois précédente. */
export function SummaryPage() {
  const { sessionId } = useParams();
  const loaded = useLive(
    async () => ({ summary: sessionId ? await getSessionSummary(sessionId) : null }),
    [sessionId],
  );

  if (loaded === undefined) return <PageHeader title="Bilan" backTo="/" />;
  if (loaded.summary === null || loaded.summary.session.status !== 'done') {
    return (
      <>
        <PageHeader title="Bilan" backTo="/" />
        <p className="p-6 text-center text-muted">Cette séance n’existe plus.</p>
      </>
    );
  }
  return <SummaryView summary={loaded.summary} />;
}

function SummaryView({ summary }: { summary: SessionSummary }) {
  const { session, totals, records, previous, exercises } = summary;
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [note, setNote] = useState(session.note);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Retour à la page d'où l'on vient (accueil ou historique).
  const leave = () => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1));

  const remove = () => {
    deleteSession(session.id).then(
      () => {
        toast('Séance supprimée');
        navigate('/historique', { replace: true });
      },
      (error) => toast(messageOf(error), 'error'),
    );
  };

  return (
    <>
      <PageHeader
        title={session.workoutName}
        subtitle={`${formatLongDay(session.startedAt)}${session.programName ? ` · ${session.programName}` : ''}`}
        onBack={leave}
        action={<HeaderButton label="Actions sur la séance" onClick={() => setMenuOpen(true)} />}
      />

      <ActionSheet
        open={menuOpen}
        title={session.workoutName}
        actions={[
          { label: 'Corriger la séance', onSelect: () => navigate(editPath(session.id)) },
          { label: 'Supprimer la séance', danger: true, onSelect: () => setConfirmDelete(true) },
        ]}
        onClose={() => setMenuOpen(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette séance ?"
        confirmLabel="Supprimer définitivement"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      >
        <p>
          La séance «&nbsp;{session.workoutName}&nbsp;» du {formatShortDate(session.date)} et ses{' '}
          {plural(exercises.reduce((n, e) => n + e.sets.length, 0), 'série')} seront effacées. Les
          records qu’elle contenait ne compteront plus.
        </p>
        <p>Cette action est définitive. Ton programme n’est pas modifié.</p>
      </ConfirmDialog>

      <div className="space-y-8 p-4 pb-8">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Durée" value={formatDuration(totals.durationSec)} />
          <StatTile label="Volume" value={Math.round(totals.volume).toLocaleString('fr-FR')} unit="kg" />
          <StatTile label="Séries" value={String(totals.setCount)} />
        </div>

        {records.length > 0 && (
          <Section title={plural(records.length, 'record battu', 'records battus')}>
            <Card className="space-y-3 border-gold/60">
              {records.map((record) => (
                <div key={record.setId}>
                  <p className="font-semibold">{record.exerciseName}</p>
                  <p className="text-lg font-bold text-gold tabular-nums">
                    {formatLoad(record.weight)} × {record.reps}
                  </p>
                  <p className="text-sm text-muted">
                    {record.kinds.map((kind) => RECORD_LABELS[kind]).join(' · ')}
                  </p>
                </div>
              ))}
            </Card>
          </Section>
        )}

        {session.workoutId && (
          <Section title="Par rapport à la fois précédente">
            {previous ? (
              <Card className="space-y-3">
                <p className="text-sm text-muted">
                  Même séance, le {formatShortDate(previous.session.date)}
                </p>
                <Compare
                  label="Volume"
                  now={formatVolume(totals.volume)}
                  delta={totals.volume - previous.totals.volume}
                  format={(d) => formatVolume(Math.abs(d))}
                />
                <Compare
                  label="Durée"
                  now={formatDuration(totals.durationSec)}
                  delta={totals.durationSec - previous.totals.durationSec}
                  format={(d) => formatDuration(Math.abs(d))}
                  neutral
                />
                <Compare
                  label="Séries"
                  now={String(totals.setCount)}
                  delta={totals.setCount - previous.totals.setCount}
                  format={(d) => String(Math.abs(d))}
                />
              </Card>
            ) : (
              <Card>
                <p className="text-muted">
                  C’est la première fois que tu fais cette séance : la comparaison apparaîtra la
                  prochaine fois.
                </p>
              </Card>
            )}
          </Section>
        )}

        <Section title="Ce que tu as fait">
          <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
            {exercises.map((exercise) => {
              const counted = exercise.sets.filter(isCountedSet);
              const warmups = exercise.sets.filter((s) => s.done && s.type === 'warmup').length;
              const delta =
                exercise.previousVolume === null ? null : exercise.volume - exercise.previousVolume;
              return (
                <li key={exercise.id} className="border-b border-line/60 px-4 py-3 last:border-b-0">
                  <p className="font-semibold leading-snug">{exercise.name}</p>
                  <p className="tabular-nums">
                    {counted.length > 0 ? formatLifts(counted) : 'Échauffement seulement'}
                  </p>
                  <p className="text-sm text-muted">
                    {[
                      warmups > 0 ? plural(warmups, 'série d’échauffement', 'séries d’échauffement') : null,
                      exercise.volume > 0 ? `volume ${formatVolume(exercise.volume)}` : null,
                      delta !== null && delta !== 0
                        ? `${delta > 0 ? '+' : '−'}${formatVolume(Math.abs(delta))} vs la dernière fois`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {exercise.note !== '' && (
                    <p className="mt-1 text-sm text-ink/85">Note : {exercise.note}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Note de séance">
          <textarea
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              void setSessionNote(session.id, event.target.value);
            }}
            aria-label="Note de séance"
            placeholder="Ajoute une note si tu veux te souvenir de quelque chose."
            rows={3}
            maxLength={500}
            className="w-full rounded-2xl border border-line bg-raised px-4 py-3 text-ink outline-none placeholder:text-muted focus:border-accent"
          />
        </Section>

        <Link to={editPath(session.id)} className={buttonClass('secondary')}>
          Corriger la séance
        </Link>
        <Link to="/" className={buttonClass('primary')}>
          Retour à l’accueil
        </Link>
      </div>
    </>
  );
}

/** Une ligne de comparaison : valeur du jour et écart avec la fois précédente. */
function Compare({
  label,
  now,
  delta,
  format,
  neutral = false,
}: {
  label: string;
  now: string;
  delta: number;
  format: (delta: number) => string;
  /** Un écart ni bon ni mauvais en soi (la durée). */
  neutral?: boolean;
}) {
  const tone = delta === 0 || neutral ? 'text-muted' : delta > 0 ? 'text-accent' : 'text-gold';
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-20 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-lg font-semibold tabular-nums">{now}</span>
      <span className={`shrink-0 font-semibold tabular-nums ${tone}`}>
        {delta === 0 ? 'identique' : `${delta > 0 ? '+' : '−'}${format(delta)}`}
      </span>
    </div>
  );
}
