import { useState } from 'react';
import {
  PERIODS,
  getExerciseStats,
  periodStart,
  useLive,
  type ExercisePoint,
  type Period,
} from '../data';
import { Card, Chip, Section } from '../ui/components';
import { formatKg, formatLoad, formatNumber, formatShortDate, formatVolume, plural } from '../ui/format';
import { TrendChart, type TrendPoint } from '../ui/TrendChart';

// Courbe de progression et tableau des records d'un exercice : onglet Stats et fiches de la bibliothèque.

export function PeriodChips({ value, onChange }: { value: Period; onChange: (period: Period) => void }) {
  return (
    // Les bords s'estompent : on voit qu'il reste des choix en faisant glisser.
    <div
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1.5rem),transparent)]"
      role="group"
      aria-label="Période"
    >
      {PERIODS.map((period) => (
        <Chip key={period.value} selected={period.value === value} onClick={() => onChange(period.value)}>
          {period.label}
        </Chip>
      ))}
    </div>
  );
}

export function EmptyNote({ children }: { children: string }) {
  return <p className="rounded-2xl bg-raised px-4 py-6 text-center text-muted">{children}</p>;
}

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

/** Courbe de l'exercice (période et mesure au choix), puis ses records. */
export function ExerciseProgress({ exerciseId, name }: { exerciseId: string; name: string }) {
  const [period, setPeriod] = useState<Period>('3m');
  const [metric, setMetric] = useState<Metric>('maxWeight');
  const stats = useLive(() => getExerciseStats(exerciseId), [exerciseId]);

  const start = periodStart(period);
  const points = (stats?.points ?? []).filter((p) => start === null || p.date >= start);
  const bodyweightOnly = (stats?.points ?? []).every((p) => p.maxWeight === 0);
  const trend = toTrend(points, metric, bodyweightOnly);
  const metricLabel = bodyweightOnly ? 'Répétitions de la meilleure série' : METRICS.find((m) => m.value === metric)!.label;
  // La « meilleure série » est un produit charge × répétitions : un écart en kg n'aurait pas de sens.
  const comparable = bodyweightOnly || metric !== 'bestSet';
  const change = comparable && trend.length >= 2 ? trend[trend.length - 1].value - trend[0].value : null;
  const unit = bodyweightOnly ? 'rép.' : 'kg';

  return (
    <div className="space-y-6">
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
          <EmptyNote>
            {metric === 'e1rm' && points.length > 0
              ? 'Pas d’estimation possible : il faut une charge et 12 répétitions au plus.'
              : 'Aucune séance sur cette période.'}
          </EmptyNote>
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
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Répétitions
                </th>
                <th scope="col" className="px-2 py-2.5 font-semibold">
                  Meilleure charge
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  Date
                </th>
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
