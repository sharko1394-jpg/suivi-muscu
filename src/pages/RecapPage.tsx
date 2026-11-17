import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import {
  MUSCLE_LABELS,
  getRecap,
  localDate,
  markRecapSeen,
  monthWeeks,
  nextRecapKey,
  previousRecapKey,
  recapPeriod,
  useLive,
  type Recap,
  type RecapPeriod,
  type RecapTotals,
} from '../data';
import { Button, Card, PageHeader, Section, StatTile } from '../ui/components';
import {
  formatDuration,
  formatKg,
  formatLoad,
  formatMonth,
  formatMonthName,
  formatNumber,
  formatOfMonth,
  formatRecapTitle,
  formatShortDate,
  formatVolume,
  messageOf,
  plural,
} from '../ui/format';
import { useNow } from '../ui/hooks';
import { IconChevronLeft, IconChevronRight, IconShare, IconSparkle, IconTrophy } from '../ui/icons';
import { saveFile } from '../ui/platform';
import { useToast } from '../ui/toast';
import { recapPath } from './paths';
import { drawRecapImage } from './recapImage';
import { summaryPath } from './SessionPage';

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const monthName = (period: RecapPeriod) => formatMonthName(period.year, period.month! - 1);
const recapTitle = formatRecapTitle;
const ofMonth = formatOfMonth;

/** Volume lisible : en tonnes au-delà de 10 000 kg. */
function formatTonnage(kg: number): string {
  return kg >= 10_000 ? `${formatNumber(Math.round(kg / 100) / 10)} t` : formatVolume(kg);
}

function signed(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value))}`;
}

/** Comparaison avec la période d'avant, en une phrase. */
function comparison(recap: Recap): string | null {
  const previous = recap.previous;
  if (!previous || previous.sessions === 0) return null;
  const before = recapPeriod(previousRecapKey(recap.period))!;
  const name = before.kind === 'year' ? String(before.year) : monthName(before);
  const diff = recap.totals.sessions - previous.sessions;
  const sessions =
    diff === 0
      ? `Autant de séances qu’en ${name}`
      : `${signed(diff)} ${Math.abs(diff) > 1 ? 'séances' : 'séance'} par rapport à ${name}`;
  if (previous.volume <= 0) return sessions;
  const volume = Math.round(((recap.totals.volume - previous.volume) / previous.volume) * 100);
  return `${sessions} · volume ${signed(volume)} %`;
}

export default function RecapPage() {
  const { period: key = '' } = useParams();
  const now = useNow(60_000);
  const today = localDate(now);
  const recap = useLive(() => getRecap(key), [key, today]);
  const period = recapPeriod(key);

  // Bilan d'une période finie : sa carte disparaît de l'accueil.
  const finished = recap !== undefined && recap !== null && !recap.inProgress;
  useEffect(() => {
    if (finished) void markRecapSeen(key);
  }, [finished, key]);

  if (!period) return <Navigate to="/historique" replace />;
  const nextKey = nextRecapKey(period);
  const canNext = recapPeriod(nextKey)!.start <= today;
  const arrow = 'flex size-12 shrink-0 items-center justify-center rounded-full bg-raised active:bg-line';

  return (
    <>
      <PageHeader
        title={recapTitle(period)}
        subtitle={`${period.kind === 'year' ? 'Bilan de l’année' : 'Bilan du mois'}${recap?.inProgress ? ' · en cours' : ''}`}
        backTo="/historique"
      />
      <div className="space-y-6 p-4 pb-8">
        <nav className="flex items-center gap-2" aria-label="Autres bilans">
          <Link to={recapPath(previousRecapKey(period))} aria-label="Bilan précédent" className={arrow}>
            <IconChevronLeft />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            {period.kind === 'month' && (
              <Link
                to={recapPath(String(period.year))}
                className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-muted underline underline-offset-4 active:text-ink"
              >
                Bilan de l’année {period.year}
              </Link>
            )}
          </div>
          {canNext ? (
            <Link to={recapPath(nextKey)} aria-label="Bilan suivant" className={arrow}>
              <IconChevronRight />
            </Link>
          ) : (
            <span className={`${arrow} opacity-35`} aria-hidden="true">
              <IconChevronRight />
            </span>
          )}
        </nav>

        {recap === null && <Navigate to="/historique" replace />}
        {recap && recap.totals.sessions === 0 && (
          <Card>
            <p className="text-lg font-semibold">
              {period.start > today ? 'Ce bilan n’existe pas encore.' : 'Aucune séance sur cette période.'}
            </p>
          </Card>
        )}
        {recap && recap.totals.sessions > 0 && <RecapContent recap={recap} />}
      </div>
    </>
  );
}

function Hero({ recap }: { recap: Recap }) {
  const { totals, period } = recap;
  const compare = comparison(recap);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface px-5 py-6 text-center">
      <span className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/35 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-24 -left-16 size-48 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative">
        <p className="flex items-center justify-center gap-1.5 text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-muted">
          <IconSparkle className="size-4 text-gold" />
          {period.kind === 'year' ? `Ton année ${period.year}` : `Ton mois ${ofMonth(period)}`}
        </p>
        <p className="mt-1 text-7xl font-bold leading-none tabular-nums text-accent">{totals.sessions}</p>
        <p className="mt-1 text-xl font-semibold">{totals.sessions > 1 ? 'séances' : 'séance'}</p>
        {compare && <p className="mt-2 text-sm text-muted">{compare}</p>}
      </div>
    </div>
  );
}

function Tiles({ totals, records }: { totals: RecapTotals; records: number }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatTile label="Temps total" value={formatDuration(totals.durationSec)} />
      <StatTile label="Volume" value={formatTonnage(totals.volume)} />
      <StatTile label="Séries" value={String(totals.sets)} />
      <StatTile label="Records" value={String(records)} tone={records > 0 ? 'warn' : undefined} />
      <StatTile label="Jours d’entraînement" value={String(totals.activeDays)} />
      <StatTile label="Répétitions" value={totals.reps.toLocaleString('fr-FR')} />
    </div>
  );
}

function MonthCalendar({ recap }: { recap: Recap }) {
  const { period } = recap;
  const active = new Set(recap.days);
  return (
    <Section title="Jours d’entraînement">
      <Card>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_INITIALS.map((initial, index) => (
            <span key={index} className="py-1 text-xs font-semibold text-muted" aria-hidden="true">
              {initial}
            </span>
          ))}
          {monthWeeks(period.year, period.month! - 1)
            .flat()
            .map((day, index) =>
              day === null ? (
                <span key={index} />
              ) : (
                <span
                  key={day}
                  className={`mx-auto flex size-10 items-center justify-center rounded-full text-sm tabular-nums ${
                    active.has(day) ? 'bg-accent font-bold text-accent-ink shadow-[0_0_14px_var(--accent-glow)]' : 'text-muted'
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
              ),
            )}
        </div>
      </Card>
    </Section>
  );
}

function MonthBars({ recap }: { recap: Recap }) {
  const max = Math.max(1, ...recap.months.map((m) => m.sessions));
  return (
    <Section title="Mois par mois">
      <Card>
        <div className="flex h-40 items-stretch gap-1">
          {recap.months.map((month, index) => (
            <Link
              key={month.key}
              to={recapPath(month.key)}
              aria-label={`${capitalize(formatMonth(recap.period.year, index))} : ${plural(month.sessions, 'séance')}`}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-lg active:bg-raised"
            >
              <span className="text-xs font-bold tabular-nums">{month.sessions > 0 ? month.sessions : ''}</span>
              <span
                className={`w-full max-w-6 rounded-t-md ${month.sessions > 0 ? 'bg-accent' : 'bg-white/10'}`}
                style={{ height: `${month.sessions > 0 ? Math.max(8, (month.sessions / max) * 100) : 3}px` }}
              />
              <span className="text-[0.7rem] font-semibold text-muted">{MONTH_INITIALS[index]}</span>
            </Link>
          ))}
        </div>
      </Card>
    </Section>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="overflow-hidden rounded-3xl border border-line bg-surface">{children}</ul>;
}

const rowClass = 'flex min-h-14 items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-b-0';

function RecapContent({ recap }: { recap: Recap }) {
  const toast = useToast();
  const [sharing, setSharing] = useState(false);
  const [waitingTap, setWaitingTap] = useState<File | null>(null);
  const { period, totals } = recap;

  async function deliver(file: File) {
    const result = await saveFile(file);
    if (result === 'needs-gesture') {
      setWaitingTap(file);
      return;
    }
    setWaitingTap(null);
    if (result === 'saved') toast('Image du bilan prête');
  }

  const share = async () => {
    if (waitingTap) {
      await deliver(waitingTap);
      return;
    }
    setSharing(true);
    try {
      const top = recap.records.length > 0 ? recap.records : [];
      const blob = await drawRecapImage({
        kicker: period.kind === 'year' ? 'Mon année muscu' : 'Mon bilan du mois',
        title: recapTitle(period),
        big: { value: String(totals.sessions), label: totals.sessions > 1 ? 'séances' : 'séance' },
        tiles: [
          { label: 'Temps total', value: formatDuration(totals.durationSec) },
          { label: 'Volume soulevé', value: formatTonnage(totals.volume) },
          { label: 'Séries', value: String(totals.sets) },
          { label: recap.recordCount > 1 ? 'Records battus' : 'Record battu', value: String(recap.recordCount) },
        ],
        listTitle: top.length > 0 ? 'Records' : 'Le plus travaillé',
        list:
          top.length > 0
            ? top.map((r) => ({ label: r.exerciseName, value: `${formatLoad(r.weight)} × ${r.reps}` }))
            : recap.exercises.map((e) => ({ label: e.name, value: plural(e.sets, 'série') })),
        footer: 'Suivi Muscu',
      });
      const name = `bilan-${period.key}.png`;
      await deliver(new File([blob], name, { type: 'image/png' }));
    } catch (error) {
      toast(messageOf(error), 'error');
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <Hero recap={recap} />
      <Tiles totals={totals} records={recap.recordCount} />
      {period.kind === 'month' ? <MonthCalendar recap={recap} /> : <MonthBars recap={recap} />}

      {recap.records.length > 0 && (
        <Section title={recap.recordCount > 1 ? `${recap.recordCount} records battus` : '1 record battu'}>
          <Rows>
            {recap.records.slice(0, 6).map((record) => (
              <li key={record.exerciseId} className={rowClass}>
                <IconTrophy className="size-5 shrink-0 text-gold" />
                <span className="min-w-0 flex-1 truncate font-medium">{record.exerciseName}</span>
                <span className="shrink-0 font-bold tabular-nums">
                  {formatLoad(record.weight)} × {record.reps}
                </span>
                <span className="w-14 shrink-0 text-right text-sm text-muted">{formatShortDate(record.date)}</span>
              </li>
            ))}
          </Rows>
        </Section>
      )}

      {recap.progress.length > 0 && (
        <Section title="Plus gros progrès">
          <Rows>
            {recap.progress.slice(0, 3).map((item) => (
              <li key={item.exerciseId} className={rowClass}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="block text-sm text-muted tabular-nums">
                    {item.unit === 'kg'
                      ? `1RM estimé ${formatNumber(Math.round(item.before))} → ${formatKg(Math.round(item.after))}`
                      : `${item.before} → ${item.after} rép.`}
                  </span>
                </span>
                <span className="shrink-0 text-lg font-bold text-accent tabular-nums">+{Math.round(item.gain * 100)} %</span>
              </li>
            ))}
          </Rows>
        </Section>
      )}

      {recap.exercises.length > 0 && (
        <Section title="Le plus travaillé">
          <Rows>
            {recap.exercises.slice(0, 3).map((exercise) => (
              <li key={exercise.exerciseId} className={rowClass}>
                <span className="min-w-0 flex-1 truncate font-medium">{exercise.name}</span>
                <span className="shrink-0 text-sm text-muted tabular-nums">
                  {plural(exercise.sets, 'série')} · {plural(exercise.sessions, 'séance')}
                </span>
              </li>
            ))}
          </Rows>
          {recap.muscles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {recap.muscles.slice(0, 4).map(({ muscle, sets }) => (
                <span key={muscle} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">
                  {MUSCLE_LABELS[muscle]} <span className="font-bold tabular-nums">{sets}</span>
                </span>
              ))}
            </div>
          )}
        </Section>
      )}

      {(recap.longest || recap.heaviest) && (
        <Section title="Séances marquantes">
          <Rows>
            {recap.longest && (
              <li className="border-b border-line/60 last:border-b-0">
                <Link to={summaryPath(recap.longest.sessionId)} className={`${rowClass} border-b-0 active:bg-raised`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-muted">La plus longue · {formatShortDate(recap.longest.date)}</span>
                    <span className="block truncate font-medium">{recap.longest.name}</span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{formatDuration(recap.longest.durationSec)}</span>
                  <IconChevronRight className="shrink-0 text-muted" />
                </Link>
              </li>
            )}
            {recap.heaviest && (
              <li className="border-b border-line/60 last:border-b-0">
                <Link to={summaryPath(recap.heaviest.sessionId)} className={`${rowClass} border-b-0 active:bg-raised`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-muted">La plus lourde · {formatShortDate(recap.heaviest.date)}</span>
                    <span className="block truncate font-medium">{recap.heaviest.name}</span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{formatVolume(recap.heaviest.volume)}</span>
                  <IconChevronRight className="shrink-0 text-muted" />
                </Link>
              </li>
            )}
          </Rows>
        </Section>
      )}

      {recap.bodyweight && (
        <Section title="Poids de corps">
          <Card className="flex items-baseline justify-between gap-3">
            <p className="text-xl font-bold tabular-nums">
              {formatKg(recap.bodyweight.from)} → {formatKg(recap.bodyweight.to)}
            </p>
            <p className="text-sm font-semibold text-muted tabular-nums">
              {signed(Math.round((recap.bodyweight.to - recap.bodyweight.from) * 10) / 10)} kg
            </p>
          </Card>
        </Section>
      )}

      {recap.goals.length > 0 && (
        <Section title="Objectifs atteints">
          <Rows>
            {recap.goals.map((goal, index) => (
              <li key={index} className={rowClass}>
                <IconTrophy className="size-5 shrink-0 text-gold" />
                <span className="min-w-0 flex-1 truncate font-medium">{goal.title}</span>
                <span className="shrink-0 text-sm text-muted">{formatShortDate(goal.date)}</span>
              </li>
            ))}
          </Rows>
        </Section>
      )}

      <Button variant="primary" onClick={() => void share()} disabled={sharing}>
        <IconShare className="size-5" />
        {sharing ? 'Préparation…' : waitingTap ? 'Image prête : partager' : 'Partager l’image du bilan'}
      </Button>
    </>
  );
}
