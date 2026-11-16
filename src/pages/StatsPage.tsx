import { useState, type FormEvent } from 'react';
import {
  MUSCLE_LABELS,
  PERIODS,
  deleteBodyweight,
  getExerciseStats,
  getGeneralStats,
  listBodyweights,
  listTrackedExercises,
  localDate,
  periodStart,
  saveBodyweight,
  useLive,
  type Bodyweight,
  type ExercisePoint,
  type Period,
} from '../data';
import { Button, Card, Chip, ConfirmDialog, PageHeader, Section } from '../ui/components';
import { SegmentedControl } from '../ui/controls';
import {
  formatDay,
  formatKg,
  formatLoad,
  formatNumber,
  formatShortDate,
  formatVolume,
  messageOf,
  plural,
} from '../ui/format';
import { IconChevronLeft, IconChevronRight } from '../ui/icons';
import { useToast } from '../ui/toast';
import { TrendChart, type TrendPoint } from '../ui/TrendChart';

type View = 'exercise' | 'general' | 'body';

export default function StatsPage() {
  const [view, setView] = useState<View>('exercise');
  return (
    <>
      <PageHeader title="Stats" />
      <div className="space-y-6 p-4 pb-8">
        <SegmentedControl
          label="Statistiques affichées"
          value={view}
          options={[
            { value: 'exercise', label: 'Exercices' },
            { value: 'general', label: 'Assiduité' },
            { value: 'body', label: 'Poids' },
          ]}
          onChange={setView}
        />
        {view === 'exercise' && <ExerciseView />}
        {view === 'general' && <GeneralView />}
        {view === 'body' && <BodyView />}
      </div>
    </>
  );
}

function PeriodChips({ value, onChange }: { value: Period; onChange: (period: Period) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Période">
      {PERIODS.map((period) => (
        <Chip key={period.value} selected={period.value === value} onClick={() => onChange(period.value)}>
          {period.label}
        </Chip>
      ))}
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-2xl bg-raised px-4 py-6 text-center text-muted">{children}</p>;
}

// ---------- Par exercice ----------

type Metric = 'maxWeight' | 'e1rm' | 'volume' | 'bestSet';

const METRICS: { value: Metric; label: string }[] = [
  { value: 'maxWeight', label: 'Charge max' },
  { value: 'e1rm', label: '1RM estimé' },
  { value: 'volume', label: 'Volume' },
  { value: 'bestSet', label: 'Meilleure série' },
];

function toTrend(points: ExercisePoint[], metric: Metric, bodyweightOnly: boolean): TrendPoint[] {
  return points.flatMap((point): TrendPoint[] => {
    const label = formatShortDate(point.date);
    const best = `${formatLoad(point.bestSet.weight)} × ${point.bestSet.reps}`;
    if (bodyweightOnly) return [{ label, value: point.bestSet.reps, detail: best }];
    switch (metric) {
      case 'maxWeight':
        return [{ label, value: point.maxWeight, detail: formatKg(point.maxWeight) }];
      case 'e1rm':
        return point.e1rm === null ? [] : [{ label, value: point.e1rm, detail: formatKg(point.e1rm) }];
      case 'volume':
        return [{ label, value: point.volume, detail: formatVolume(point.volume) }];
      case 'bestSet':
        return [{ label, value: point.bestSet.weight * point.bestSet.reps, detail: best }];
    }
  });
}

function ExerciseView() {
  const tracked = useLive(() => listTrackedExercises(), []);
  const [chosen, setChosen] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('3m');
  const [metric, setMetric] = useState<Metric>('maxWeight');

  const exerciseId = chosen ?? tracked?.[0]?.exerciseId ?? null;
  const stats = useLive(
    async () => (exerciseId ? await getExerciseStats(exerciseId) : null),
    [exerciseId],
  );

  if (tracked === undefined) return null;
  if (tracked.length === 0) {
    return <Empty>Tes graphiques apparaîtront ici après ta première séance terminée.</Empty>;
  }

  const start = periodStart(period);
  const points = (stats?.points ?? []).filter((p) => start === null || p.date >= start);
  const bodyweightOnly = (stats?.points ?? []).every((p) => p.maxWeight === 0);
  const trend = toTrend(points, metric, bodyweightOnly);
  const metricLabel = bodyweightOnly
    ? 'Répétitions de la meilleure série'
    : METRICS.find((m) => m.value === metric)!.label;
  const name = tracked.find((t) => t.exerciseId === exerciseId)?.name ?? '';
  // La « meilleure série » est un produit charge × répétitions : un écart en kg n'aurait pas de sens.
  const comparable = bodyweightOnly || metric !== 'bestSet';
  const change =
    comparable && trend.length >= 2 ? trend[trend.length - 1].value - trend[0].value : null;
  const unit = bodyweightOnly ? 'rép.' : 'kg';

  return (
    <div className="space-y-6">
      <label className="block space-y-2">
        <span className="block px-1 text-sm font-semibold uppercase tracking-wider text-muted">
          Exercice
        </span>
        <select
          value={exerciseId ?? ''}
          onChange={(event) => setChosen(event.target.value)}
          className="h-14 w-full rounded-2xl border border-line bg-raised px-4 text-lg font-semibold text-ink outline-none focus:border-accent"
        >
          {tracked.map((exercise) => (
            <option key={exercise.exerciseId} value={exercise.exerciseId}>
              {exercise.name} ({plural(exercise.sessionCount, 'séance')})
            </option>
          ))}
        </select>
      </label>

      <PeriodChips value={period} onChange={setPeriod} />

      <Card className="space-y-4">
        {!bodyweightOnly && (
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Mesure affichée">
            {METRICS.map((m) => (
              <Chip key={m.value} selected={m.value === metric} onClick={() => setMetric(m.value)}>
                {m.label}
              </Chip>
            ))}
          </div>
        )}
        <div>
          <p className="text-lg font-bold">{metricLabel}</p>
          <p className="text-sm text-muted">
            {change === null
              ? plural(trend.length, 'séance')
              : `${plural(trend.length, 'séance')} · ${change > 0 ? '+' : change < 0 ? '−' : ''}${formatNumber(Math.abs(change))} ${unit} sur la période`}
          </p>
        </div>
        {trend.length === 0 ? (
          <Empty>
            {metric === 'e1rm' && points.length > 0
              ? 'Pas d’estimation possible : il faut une charge et 12 répétitions au plus.'
              : 'Aucune séance sur cette période.'}
          </Empty>
        ) : (
          <TrendChart
            points={trend}
            title={`${metricLabel} pour ${name}, ${plural(trend.length, 'séance')}`}
            formatValue={(value) => formatNumber(Math.round(value * 10) / 10)}
          />
        )}
      </Card>

      <Section title="Mes records">
        <div className="overflow-hidden rounded-3xl border border-line bg-surface">
          <table className="w-full text-left">
            <caption className="sr-only">Meilleure charge de {name} selon le nombre de répétitions</caption>
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th scope="col" className="px-4 py-2.5 font-semibold">Répétitions</th>
                <th scope="col" className="px-2 py-2.5 font-semibold">Meilleure charge</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.repMax ?? []).map((row) => (
                <tr key={row.reps} className="border-b border-line/60 last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-medium tabular-nums">
                    {row.reps} ou plus
                  </th>
                  <td className="px-2 py-3 text-lg font-bold tabular-nums">
                    {row.weight === null ? <span className="font-normal text-muted">—</span> : formatLoad(row.weight)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted">
                    {row.date === null ? '' : formatShortDate(row.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ---------- Assiduité et muscles ----------

function GeneralView() {
  const stats = useLive(() => getGeneralStats(), []);
  const [weekIndex, setWeekIndex] = useState(0);
  if (stats === undefined) return null;
  if (stats.totalSessions === 0) {
    return <Empty>Ton assiduité apparaîtra ici après ta première séance terminée.</Empty>;
  }

  const week = stats.muscleWeeks[Math.min(weekIndex, stats.muscleWeeks.length - 1)];
  const maxSets = Math.max(1, ...(week?.muscles.map((m) => m.sets) ?? [1]));
  const arrow =
    'flex size-12 shrink-0 items-center justify-center rounded-full bg-raised active:bg-line disabled:opacity-35';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Séances" value={String(stats.totalSessions)} detail="au total" />
        <Tile label="Série en cours" value={String(stats.streaks.current)} detail={stats.streaks.current > 1 ? 'semaines' : 'semaine'} />
        <Tile label="Record" value={String(stats.streaks.best)} detail={stats.streaks.best > 1 ? 'semaines' : 'semaine'} />
      </div>

      <Section title="Séances par semaine">
        <Card>
          <TrendChart
            kind="bar"
            points={stats.attendance.map((w) => ({
              label: formatShortDate(w.week),
              value: w.count,
              detail: `Semaine du ${formatShortDate(w.week)} : ${plural(w.count, 'séance')}`,
            }))}
            title={`Séances par semaine sur les 12 dernières semaines`}
            formatValue={(value) => String(value)}
          />
        </Card>
      </Section>

      {week && (
        <Section title="Séries par groupe musculaire">
          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekIndex((i) => i + 1)}
                disabled={weekIndex >= stats.muscleWeeks.length - 1}
                aria-label="Semaine précédente"
                className={arrow}
              >
                <IconChevronLeft />
              </button>
              <p className="min-w-0 flex-1 text-center">
                <span className="block font-bold">Semaine du {formatShortDate(week.week)}</span>
                <span className="block text-sm text-muted">{plural(week.total, 'série')}</span>
              </p>
              <button
                type="button"
                onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
                disabled={weekIndex === 0}
                aria-label="Semaine suivante"
                className={arrow}
              >
                <IconChevronRight />
              </button>
            </div>
            <ul className="space-y-2.5">
              {week.muscles.map(({ muscle, sets }) => (
                <li key={muscle} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate">{MUSCLE_LABELS[muscle]}</span>
                  <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${(sets / maxSets) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right font-bold tabular-nums">{sets}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}
    </div>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-2 py-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted">{detail}</p>
    </div>
  );
}

// ---------- Poids de corps ----------

function BodyView() {
  const toast = useToast();
  const entries = useLive(() => listBodyweights(), []);
  const [period, setPeriod] = useState<Period>('3m');
  const [date, setDate] = useState(() => localDate(Date.now()));
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Bodyweight | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await saveBodyweight(date, Number(weight.trim().replace(',', '.')));
      setWeight('');
      setError(null);
      toast('Pesée enregistrée');
    } catch (e) {
      setError(messageOf(e));
    }
  }

  const start = periodStart(period);
  const shown = (entries ?? []).filter((b) => start === null || b.date >= start);
  const change = shown.length >= 2 ? shown[shown.length - 1].weightKg - shown[0].weightKg : null;
  const field =
    'h-14 w-full min-w-0 rounded-2xl border border-line bg-raised px-4 text-ink outline-none placeholder:text-muted focus:border-accent';

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={save} noValidate className="space-y-3">
          <p className="text-lg font-bold">Ajouter une pesée</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              max={localDate(Date.now())}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Jour de la pesée"
              className={field}
            />
            <input
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={(event) => {
                setWeight(event.target.value);
                setError(null);
              }}
              aria-label="Poids, en kg"
              placeholder="Poids en kg"
              autoComplete="off"
              enterKeyHint="done"
              className={field}
            />
          </div>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={weight.trim() === ''}>
            Enregistrer
          </Button>
        </form>
      </Card>

      {entries !== undefined && entries.length === 0 ? (
        <Empty>Ta courbe de poids apparaîtra ici dès ta première pesée.</Empty>
      ) : (
        <>
          <PeriodChips value={period} onChange={setPeriod} />
          <Card className="space-y-4">
            <div>
              <p className="text-lg font-bold">Poids de corps</p>
              <p className="text-sm text-muted">
                {change === null
                  ? plural(shown.length, 'pesée')
                  : `${plural(shown.length, 'pesée')} · ${change > 0 ? '+' : change < 0 ? '−' : ''}${formatNumber(Math.abs(Math.round(change * 10) / 10))} kg sur la période`}
              </p>
            </div>
            {shown.length === 0 ? (
              <Empty>Aucune pesée sur cette période.</Empty>
            ) : (
              <TrendChart
                points={shown.map((b) => ({
                  label: formatShortDate(b.date),
                  value: b.weightKg,
                  detail: formatKg(b.weightKg),
                }))}
                title={`Poids de corps, ${plural(shown.length, 'pesée')}`}
                formatValue={(value) => formatNumber(Math.round(value * 10) / 10)}
              />
            )}
          </Card>

          <Section title="Dernières pesées">
            <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
              {[...(entries ?? [])]
                .reverse()
                .slice(0, 10)
                .map((entry) => (
                  <li key={entry.id} className="flex min-h-14 items-center gap-3 border-b border-line/60 px-4 last:border-b-0">
                    <span className="min-w-0 flex-1 first-letter:uppercase">{formatDay(entry.date)}</span>
                    <span className="text-lg font-bold tabular-nums">{formatKg(entry.weightKg)}</span>
                    <button
                      type="button"
                      onClick={() => setToDelete(entry)}
                      className="min-h-11 px-2 text-sm font-semibold text-muted underline underline-offset-4 active:text-ink"
                    >
                      Supprimer
                    </button>
                  </li>
                ))}
            </ul>
          </Section>
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer cette pesée ?"
        confirmLabel="Supprimer"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void deleteBodyweight(toDelete.id).then(() => toast('Pesée supprimée'));
          setToDelete(null);
        }}
      >
        {toDelete && (
          <p>
            {formatKg(toDelete.weightKg)}, le {formatDay(toDelete.date)}.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
