import { useState, type FormEvent } from 'react';
import {
  MUSCLE_LABELS,
  deleteBodyweight,
  getGeneralStats,
  listBodyweights,
  listTrackedExercises,
  localDate,
  periodStart,
  saveBodyweight,
  useLive,
  type Bodyweight,
  type Period,
} from '../data';
import { Button, Card, ConfirmDialog, PageHeader, Section, StatTile } from '../ui/components';
import { SegmentedControl } from '../ui/controls';
import { formatDay, formatKg, formatNumber, formatShortDate, messageOf, plural } from '../ui/format';
import { IconChevronLeft, IconChevronRight } from '../ui/icons';
import { useToast } from '../ui/toast';
import { TrendChart } from '../ui/TrendChart';
import { EmptyNote, ExerciseProgress, PeriodChips } from './ExerciseProgress';

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

const Empty = EmptyNote;

// ---------- Par exercice ----------

function ExerciseView() {
  const tracked = useLive(() => listTrackedExercises(), []);
  const [chosen, setChosen] = useState<string | null>(null);

  const exerciseId = chosen ?? tracked?.[0]?.exerciseId ?? null;

  if (tracked === undefined) return null;
  if (tracked.length === 0) {
    return <Empty>Tes graphiques apparaîtront ici après ta première séance terminée.</Empty>;
  }

  const name = tracked.find((t) => t.exerciseId === exerciseId)?.name ?? '';

  return (
    <div className="space-y-6">
      <label className="block space-y-2">
        <span className="block px-1 text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-muted">
          Exercice
        </span>
        <select
          value={exerciseId ?? ''}
          onChange={(event) => setChosen(event.target.value)}
          className="h-14 w-full truncate rounded-2xl border border-line bg-raised px-4 text-base font-semibold text-ink outline-none focus:border-accent"
        >
          {tracked.map((exercise) => (
            <option key={exercise.exerciseId} value={exercise.exerciseId}>
              {exercise.name} ({plural(exercise.sessionCount, 'séance')})
            </option>
          ))}
        </select>
      </label>

      {exerciseId && <ExerciseProgress key={exerciseId} exerciseId={exerciseId} name={name} />}
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
        <StatTile label="Séances au total" value={String(stats.totalSessions)} />
        <StatTile label="Semaines d’affilée" value={String(stats.streaks.current)} unit="sem." />
        <StatTile label="Record d’affilée" value={String(stats.streaks.best)} unit="sem." />
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
