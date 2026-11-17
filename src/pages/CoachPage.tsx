import type { ReactNode } from 'react';
import {
  GOALS,
  MUSCLE_LABELS,
  getCoachReport,
  getGoalStatuses,
  setSetting,
  useLive,
  type BalanceAlert,
  type CoachReport,
  type ExerciseCoaching,
  type Goal,
  type LoadStatus,
} from '../data';
import { Card, LinkRow, PageHeader, Section, StatTile } from '../ui/components';
import { GOALS_PATH } from './paths';
import { SegmentedControl } from '../ui/controls';
import { formatKg, formatLoad, formatNumber, formatReps, formatShortDate } from '../ui/format';
import { IconTrendDown, IconTrendFlat, IconTrendUp } from '../ui/icons';

/** Onglet Conseils : analyse des séances, charges à ajuster, répartition du volume, records à venir. */
export default function CoachPage() {
  const report = useLive(() => getCoachReport(), []);
  const personal = useLive(() => getGoalStatuses(), []);
  const inProgress = personal?.filter((g) => g.achievedOn === null).length ?? 0;

  return (
    <>
      <PageHeader title="Conseils" />
      <div className="space-y-8 p-4 pb-8">
        <div className="space-y-3">
          <SegmentedControl<Goal>
            label="Objectif"
            value={report?.goal ?? 'muscle'}
            options={(Object.keys(GOALS) as Goal[]).map((goal) => ({ value: goal, label: GOALS[goal].label }))}
            onChange={(goal) => void setSetting('goal', goal)}
          />
          <LinkRow
            to={GOALS_PATH}
            title="Mes objectifs"
            detail={inProgress > 0 ? `${inProgress} en cours` : personal && personal.length > 0 ? 'Tous atteints' : 'Fixe-toi un défi'}
          />
        </div>

        {report !== undefined && report.totalSessions === 0 && (
          <Card>
            <p className="text-lg font-semibold">Les conseils arrivent après ta première séance.</p>
          </Card>
        )}

        {report !== undefined && report.totalSessions > 0 && <Report report={report} />}
      </div>
    </>
  );
}

function Report({ report }: { report: CoachReport }) {
  const ready = report.exercises.filter((e) => e.advice.status === 'up').length;
  const forecasts = report.exercises.filter((e) => e.forecast.candidate || e.forecast.projection);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Séances par semaine" value={formatNumber(report.sessionsPerWeek)} />
        <StatTile
          label="Volume du mois"
          value={
            report.volumeChange === null
              ? '—'
              : `${report.volumeChange > 0 ? '+' : report.volumeChange < 0 ? '−' : ''}${Math.abs(report.volumeChange)} %`
          }
          tone={report.volumeChange === null ? undefined : report.volumeChange >= 0 ? 'good' : 'warn'}
        />
        <StatTile label="Prêts à monter" value={String(ready)} tone={ready > 0 ? 'good' : undefined} />
      </div>

      {report.exercises.length > 0 && (
        <Section title="Charges">
          <ul className="space-y-2">
            {report.exercises.map((exercise) => (
              <li key={exercise.exerciseId}>
                <LoadCard exercise={exercise} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <VolumeSection report={report} />

      {forecasts.length > 0 && (
        <Section title="Records à venir">
          <ul className="space-y-2">
            {forecasts.map((exercise) => (
              <li key={exercise.exerciseId}>
                <ForecastCard exercise={exercise} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

// ---------- Charges ----------

const STATUS: Record<LoadStatus, { label: string; icon: (p: { className?: string }) => ReactNode; className: string }> = {
  up: { label: 'Monte', icon: IconTrendUp, className: 'bg-accent text-accent-ink' },
  almost: { label: 'Bientôt', icon: IconTrendUp, className: 'bg-raised text-ink' },
  keep: { label: 'Garde', icon: IconTrendFlat, className: 'bg-raised text-muted' },
  down: { label: 'Baisse', icon: IconTrendDown, className: 'border border-gold/60 text-gold' },
  plateau: { label: 'Stagne', icon: IconTrendFlat, className: 'border border-gold/60 text-gold' },
};

/** La phrase d'action, courte. */
function suggestion({ advice, repMax, equipment }: ExerciseCoaching): string {
  const load = formatLoad(advice.weight);
  const noLoad = advice.weight === 0;
  switch (advice.status) {
    case 'up':
      return noLoad && equipment === 'poids-du-corps'
        ? `Ajoute ${formatKg(advice.suggested!)} de lest`
        : `Passe à ${formatKg(advice.suggested!)}`;
    case 'almost':
      return `Garde ${load}, encore une séance`;
    case 'keep':
      return `Garde ${load}, vise ${repMax} rép.`;
    case 'down':
      return advice.suggested === null
        ? 'Prends une variante plus facile'
        : `Redescends à ${formatKg(advice.suggested)}`;
    case 'plateau':
      return advice.suggested === null
        ? 'Change de variante quelques semaines'
        : `Décharge à ${formatKg(advice.suggested)}, puis remonte`;
  }
}

export function LoadCard({ exercise }: { exercise: ExerciseCoaching }) {
  const { advice } = exercise;
  const status = STATUS[advice.status];
  const Icon = status.icon;
  return (
    <div className="rounded-3xl border border-line bg-surface px-4 py-3">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 font-semibold leading-snug">{exercise.name}</p>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full py-1 pl-2 pr-3 text-sm font-semibold ${status.className}`}
        >
          <Icon className="size-4" />
          {status.label}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted tabular-nums">
        {formatLoad(advice.weight)} × {advice.reps.join(', ')} · {formatShortDate(advice.date)} ·{' '}
        {formatReps(exercise.repMin, exercise.repMax)} rép.
      </p>
      <p className="mt-1.5 text-lg font-semibold">{suggestion(exercise)}</p>
    </div>
  );
}

// ---------- Volume ----------

const ALERTS: Record<BalanceAlert, string> = {
  'more-push': 'Plus de poussée que de tirage : ajoute du dos.',
  'more-pull': 'Plus de tirage que de poussée : ajoute pectoraux ou épaules.',
  'legs-low': 'Le bas du corps est peu travaillé.',
  'quads-over-hams': 'Quadriceps bien plus travaillés que les ischio-jambiers.',
};

const BAR = { low: 'bg-gold', ok: 'bg-ink/85', high: 'bg-accent-bright' } as const;
const VALUE = { low: 'text-gold', ok: 'text-ink', high: 'text-accent' } as const;

function VolumeSection({ report }: { report: CoachReport }) {
  const { volume } = report;
  if (volume.muscles.length === 0) return null;
  const [min, max] = volume.target;
  const scale = Math.max(max * 1.3, ...volume.muscles.map((m) => m.perWeek));
  const pct = (value: number) => `${(value / scale) * 100}%`;

  return (
    <Section title="Répartition du volume">
      <Card className="space-y-4">
        <p className="text-sm text-muted">
          Séries / semaine · {volume.weeks} dernière{volume.weeks > 1 ? 's' : ''} semaine
          {volume.weeks > 1 ? 's' : ''} · zone {min}–{max}
        </p>
        <ul className="space-y-2.5">
          {volume.muscles.map(({ muscle, perWeek, status }) => (
            <li key={muscle} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate">{MUSCLE_LABELS[muscle]}</span>
              <span className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8">
                {/* Zone conseillée pour l'objectif. */}
                <span
                  className="absolute inset-y-0 rounded-full bg-white/14"
                  style={{ left: pct(min), width: pct(max - min) }}
                />
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${BAR[status]}`}
                  style={{ width: pct(perWeek) }}
                />
              </span>
              <span className={`w-9 shrink-0 text-right font-bold tabular-nums ${VALUE[status]}`}>
                {formatNumber(perWeek)}
              </span>
            </li>
          ))}
        </ul>

        {(volume.alerts.length > 0 || volume.neglected.length > 0) && (
          <div className="space-y-2 border-t border-line pt-3">
            {volume.alerts.map((alert) => (
              <p key={alert} className="font-medium text-gold">
                {ALERTS[alert]}
              </p>
            ))}
            {volume.neglected.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm text-muted">Rien depuis {volume.weeks * 7} jours :</span>
                {volume.neglected.map((muscle) => (
                  <span key={muscle} className="rounded-full border border-line px-2.5 py-0.5 text-sm">
                    {MUSCLE_LABELS[muscle]}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </Section>
  );
}

// ---------- Records à venir ----------

export function ForecastCard({ exercise }: { exercise: ExerciseCoaching }) {
  const { candidate, projection } = exercise.forecast;
  return (
    <div className="rounded-3xl border border-line bg-surface px-4 py-3">
      <p className="font-semibold leading-snug">{exercise.name}</p>
      {candidate && (
        <>
          <p className="mt-1 text-2xl font-bold tabular-nums text-accent">
            {formatKg(candidate.weight)} × {candidate.reps}
          </p>
          <p className="text-sm text-muted tabular-nums">
            À ta portée · record {formatKg(candidate.record.weight!)} × {candidate.reps}
            {candidate.record.date ? ` (${formatShortDate(candidate.record.date)})` : ''}
          </p>
        </>
      )}
      {projection && (
        <p className={`${candidate ? 'mt-2' : 'mt-1'} text-base`}>
          1RM estimé <span className="font-bold">{formatKg(projection.milestone)}</span> vers le{' '}
          {formatShortDate(projection.date)}
          <span className="text-muted"> · +{formatNumber(projection.perWeek)} kg/sem.</span>
        </p>
      )}
    </div>
  );
}
