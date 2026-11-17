import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  GOALS,
  MUSCLE_LABELS,
  daysBetween,
  getBodyweightTrend,
  getCoachReport,
  getGoalStatuses,
  getRecentRecords,
  getSessionStreak,
  getWeekSets,
  getWeekSummary,
  listHistory,
  localDate,
  useLive,
  useSettings,
  type GoalStatus,
  type WidgetId,
  type WidgetSize,
} from '../data';
import {
  formatAgo,
  formatDuration,
  formatGoalTarget,
  formatKg,
  formatNearDay,
  formatNumber,
  formatShortDate,
  formatVolume,
  plural,
} from '../ui/format';
import { IconCheck, IconFlame, IconTarget, IconTrophy } from '../ui/icons';
import { GOALS_PATH } from './paths';
import { summaryPath } from './SessionPage';

// Widgets de l'accueil (V2), en dehors de la séance du jour et de « Fait aujourd'hui ».
// Petit = une demi-largeur (un chiffre clé), grand = toute la largeur (le détail).

export function DataWidget({ id, size, now }: { id: WidgetId; size: WidgetSize; now: number }) {
  const day = localDate(now);
  switch (id) {
    case 'week':
      return <WeekWidget size={size} now={now} day={day} />;
    case 'lastSession':
      return <LastSessionWidget size={size} now={now} />;
    case 'ready':
      return <ReadyWidget size={size} />;
    case 'records':
      return <RecordsWidget size={size} now={now} day={day} />;
    case 'forecast':
      return <ForecastWidget size={size} />;
    case 'bodyweight':
      return <BodyweightWidget size={size} now={now} day={day} />;
    case 'volume':
      return <VolumeWidget now={now} day={day} />;
    case 'streak':
      return <StreakWidget size={size} now={now} day={day} />;
    case 'goals':
      return <GoalsWidget size={size} now={now} day={day} />;
    default:
      return null;
  }
}

// ---------- Cadre commun ----------

function Frame({
  title,
  to,
  size,
  children,
}: {
  title: string;
  to?: string;
  size: WidgetSize;
  children: ReactNode;
}) {
  const className = `flex h-full flex-col rounded-3xl border border-line bg-surface p-4 ${
    size === 'small' ? 'min-h-36' : ''
  }`;
  const body = (
    <>
      <p className="truncate text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
      {children}
    </>
  );
  return to ? (
    <Link to={to} className={`${className} active:bg-raised`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Grand chiffre d'un petit widget, collé en bas du cadre. */
function BigValue({ value, unit, tone }: { value: string; unit?: string; tone?: 'accent' | 'gold' }) {
  return (
    <p
      className={`mt-auto pt-3 text-3xl font-bold leading-none tabular-nums ${
        tone === 'accent' ? 'text-accent' : tone === 'gold' ? 'text-gold' : ''
      }`}
    >
      {value}
      {unit && <span className="ml-1 text-base font-semibold text-muted">{unit}</span>}
    </p>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{children}</p>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-auto pt-3 text-sm text-muted">{children}</p>;
}

// ---------- Cette semaine ----------

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function WeekWidget({ size, now, day }: { size: WidgetSize; now: number; day: string }) {
  const week = useLive(() => getWeekSummary(now), [day]);
  if (!week) return <Frame title="Cette semaine" size={size}>{null}</Frame>;

  if (size === 'small') {
    return (
      <Frame title="Cette semaine" to="/historique" size={size}>
        <BigValue value={String(week.count)} />
        <Sub>{week.count > 1 ? 'séances' : 'séance'}</Sub>
        <div className="mt-3 flex justify-between" aria-hidden="true">
          {week.days.map((d) => (
            <span
              key={d.date}
              className={`size-2.5 rounded-full ${
                d.done ? 'bg-accent' : d.today ? 'border-2 border-accent-bright/70' : 'bg-raised'
              }`}
            />
          ))}
        </div>
      </Frame>
    );
  }

  return (
    <Frame title="Cette semaine" to="/historique" size={size}>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p>
          <span className="text-3xl font-bold tabular-nums">{week.count}</span>{' '}
          <span className="text-muted">{week.count > 1 ? 'séances' : 'séance'}</span>
        </p>
        {week.streak > 1 && (
          <p className="text-sm font-medium text-muted">{plural(week.streak, 'semaine')} d’affilée</p>
        )}
      </div>
      <ol className="mt-3 grid grid-cols-7 gap-1 text-center">
        {week.days.map((d, index) => (
          <li key={d.date} className="flex flex-col items-center gap-1">
            <span className={`text-xs font-semibold ${d.today ? 'text-ink' : 'text-muted'}`}>
              {DAY_LETTERS[index]}
            </span>
            <span
              className={`flex size-8 items-center justify-center rounded-full ${
                d.done
                  ? 'bg-accent text-accent-ink'
                  : d.today
                    ? 'border-2 border-accent-bright/70'
                    : 'bg-raised'
              }`}
            >
              {d.done && <IconCheck className="size-4" aria-label="Séance faite" />}
            </span>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

// ---------- Dernière séance ----------

function LastSessionWidget({ size, now }: { size: WidgetSize; now: number }) {
  const last = useLive(async () => (await listHistory())[0] ?? null, []);
  if (last === undefined) return <Frame title="Dernière séance" size={size}>{null}</Frame>;
  if (last === null) {
    return (
      <Frame title="Dernière séance" size={size}>
        <Empty>Aucune séance pour l’instant</Empty>
      </Frame>
    );
  }
  const { session, totals } = last;

  if (size === 'small') {
    return (
      <Frame title="Dernière séance" to={summaryPath(session.id)} size={size}>
        <p className="mt-auto line-clamp-2 pt-3 text-xl font-bold leading-tight">{session.workoutName}</p>
        <Sub>{formatAgo(session.startedAt, now)}</Sub>
      </Frame>
    );
  }
  return (
    <Frame title="Dernière séance" to={summaryPath(session.id)} size={size}>
      <div className="mt-2 flex items-baseline gap-3">
        <p className="min-w-0 flex-1 truncate text-2xl font-bold">{session.workoutName}</p>
        <p className="shrink-0 text-sm font-medium text-muted first-letter:uppercase">
          {formatAgo(session.startedAt, now)}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted tabular-nums">
        {formatDuration(totals.durationSec)} · {plural(totals.setCount, 'série')}
        {totals.volume > 0 ? ` · ${formatVolume(totals.volume)}` : ''}
      </p>
    </Frame>
  );
}

// ---------- Prêts à monter (Conseils) ----------

function ReadyWidget({ size }: { size: WidgetSize }) {
  const report = useLive(() => getCoachReport(), []);
  if (!report) return <Frame title="Prêts à monter" size={size}>{null}</Frame>;
  const ready = report.exercises.filter((e) => e.advice.status === 'up' && e.advice.suggested !== null);

  if (size === 'small') {
    return (
      <Frame title="Prêts à monter" to="/conseils" size={size}>
        <BigValue value={String(ready.length)} tone={ready.length > 0 ? 'accent' : undefined} />
        <Sub>{ready.length > 0 ? ready.map((e) => e.name).join(', ') : 'Rien pour l’instant'}</Sub>
      </Frame>
    );
  }
  return (
    <Frame title="Prêts à monter" to="/conseils" size={size}>
      {ready.length === 0 ? (
        <Empty>Rien pour l’instant</Empty>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {ready.slice(0, 3).map((e) => (
            <li key={e.exerciseId} className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
              <span className="shrink-0 font-semibold text-accent tabular-nums">→ {formatKg(e.advice.suggested!)}</span>
            </li>
          ))}
          {ready.length > 3 && <li className="text-sm text-muted">et {ready.length - 3} autre{ready.length > 4 ? 's' : ''}</li>}
        </ul>
      )}
    </Frame>
  );
}

// ---------- Records récents ----------

function RecordsWidget({ size, now, day }: { size: WidgetSize; now: number; day: string }) {
  const records = useLive(() => getRecentRecords(now, 30), [day]);
  if (!records) return <Frame title="Records récents" size={size}>{null}</Frame>;

  if (size === 'small') {
    return (
      <Frame title="Records récents" to="/stats" size={size}>
        <BigValue value={String(records.length)} tone={records.length > 0 ? 'gold' : undefined} />
        <Sub>{records.length > 1 ? 'records en 30 jours' : 'record en 30 jours'}</Sub>
      </Frame>
    );
  }
  return (
    <Frame title="Records récents" to="/stats" size={size}>
      {records.length === 0 ? (
        <Empty>Aucun record ces 30 derniers jours</Empty>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {records.slice(0, 3).map((r) => (
            <li key={r.setId} className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate font-medium">{r.exerciseName}</span>
              <span className="shrink-0 font-semibold text-gold tabular-nums">
                {formatKg(r.weight)} × {r.reps}
              </span>
              <span className="w-14 shrink-0 text-right text-sm text-muted">{formatShortDate(r.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

// ---------- Prochain record (Conseils) ----------

function ForecastWidget({ size }: { size: WidgetSize }) {
  const report = useLive(() => getCoachReport(), []);
  if (!report) return <Frame title="Prochain record" size={size}>{null}</Frame>;
  const withCandidate = report.exercises.find((e) => e.forecast.candidate);
  const withProjection = report.exercises.find((e) => e.forecast.projection);
  const exercise = withCandidate ?? withProjection;

  if (!exercise) {
    return (
      <Frame title="Prochain record" size={size}>
        <Empty>Pas encore assez de séances</Empty>
      </Frame>
    );
  }
  const { candidate, projection } = exercise.forecast;

  if (size === 'small') {
    return (
      <Frame title="Prochain record" to="/conseils" size={size}>
        {candidate ? (
          <BigValue value={`${formatNumber(candidate.weight)} × ${candidate.reps}`} tone="accent" />
        ) : (
          <BigValue value={formatNumber(projection!.milestone)} unit="kg" tone="accent" />
        )}
        <Sub>{exercise.name}</Sub>
      </Frame>
    );
  }
  return (
    <Frame title="Prochain record" to="/conseils" size={size}>
      <p className="mt-2 truncate font-semibold">{exercise.name}</p>
      {candidate ? (
        <>
          <p className="text-2xl font-bold text-accent tabular-nums">
            {formatKg(candidate.weight)} × {candidate.reps}
          </p>
          <p className="text-sm text-muted tabular-nums">
            À ta portée · record {formatKg(candidate.record.weight!)} × {candidate.reps}
          </p>
        </>
      ) : (
        <p className="text-base">
          1RM estimé <span className="font-bold text-accent">{formatKg(projection!.milestone)}</span> vers le{' '}
          {formatShortDate(projection!.date)}
        </p>
      )}
    </Frame>
  );
}

// ---------- Poids de corps ----------

function BodyweightWidget({ size, now, day }: { size: WidgetSize; now: number; day: string }) {
  const trend = useLive(() => getBodyweightTrend(now), [day]);
  if (!trend) return <Frame title="Poids de corps" size={size}>{null}</Frame>;
  if (!trend.latest) {
    return (
      <Frame title="Poids de corps" to="/stats" size={size}>
        <Empty>Aucune pesée</Empty>
      </Frame>
    );
  }
  const change =
    trend.change === null
      ? formatShortDate(trend.latest.date)
      : `${trend.change > 0 ? '+' : trend.change < 0 ? '−' : ''}${formatNumber(Math.abs(trend.change))} kg en 1 mois`;

  return (
    <Frame title="Poids de corps" to="/stats" size={size}>
      {size === 'small' ? (
        <>
          <BigValue value={formatNumber(trend.latest.weightKg)} unit="kg" />
          <Sub>{change}</Sub>
        </>
      ) : (
        <>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <p className="text-3xl font-bold tabular-nums">
              {formatNumber(trend.latest.weightKg)}
              <span className="ml-1 text-base font-semibold text-muted">kg</span>
            </p>
            <p className="text-sm font-medium text-muted tabular-nums">{change}</p>
          </div>
          <Sparkline values={trend.points.map((p) => p.weightKg)} />
        </>
      )}
    </Frame>
  );
}

/** Petite courbe sans axes, juste la tendance. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${38 - ((v - min) / span) * 34}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-3 h-12 w-full text-accent" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------- Séries de la semaine ----------

function VolumeWidget({ now, day }: { now: number; day: string }) {
  const week = useLive(() => getWeekSets(now), [day]);
  const goal = useSettings()?.goal ?? 'muscle';
  if (!week) return <Frame title="Séries de la semaine" size="large">{null}</Frame>;
  if (week.muscles.length === 0) {
    return (
      <Frame title="Séries de la semaine" to="/conseils" size="large">
        <Empty>Aucune série cette semaine</Empty>
      </Frame>
    );
  }
  const [min, max] = GOALS[goal].weeklySets;
  const scale = Math.max(max * 1.3, ...week.muscles.map((m) => m.sets));
  const pct = (value: number) => `${(value / scale) * 100}%`;

  return (
    <Frame title="Séries de la semaine" to="/conseils" size="large">
      <ul className="mt-3 space-y-2">
        {week.muscles.slice(0, 6).map(({ muscle, sets }) => (
          <li key={muscle} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm">{MUSCLE_LABELS[muscle]}</span>
            <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/8">
              {/* Zone conseillée pour l'objectif. */}
              <span className="absolute inset-y-0 rounded-full bg-white/14" style={{ left: pct(min), width: pct(max - min) }} />
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${sets >= min ? 'bg-accent-bright' : 'bg-ink/70'}`}
                style={{ width: pct(sets) }}
              />
            </span>
            <span className="w-7 shrink-0 text-right text-sm font-bold tabular-nums">{sets}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

// ---------- Séances d'affilée ----------

function StreakWidget({ size, now, day }: { size: WidgetSize; now: number; day: string }) {
  const streak = useLive(() => getSessionStreak(now), [day]);
  if (!streak) return <Frame title="Séances d’affilée" size={size}>{null}</Frame>;
  const { current, best, keepBy, recent } = streak;
  const dueToday = current > 0 && keepBy === day;
  const flame = (
    <IconFlame
      className={`shrink-0 ${size === 'small' ? 'size-7' : 'size-8'} ${current > 0 ? 'text-accent-bright' : 'text-muted'}`}
      fill={current > 0 ? 'currentColor' : 'none'}
      fillOpacity={0.25}
      aria-hidden="true"
    />
  );
  const record =
    current === 0 && best === 0 ? 'Pas encore de séance' : current > 0 && current >= best ? 'Record en cours' : `Record : ${best}`;

  if (size === 'small') {
    // Demi-largeur : un titre court, le chiffre, puis ce qu'il compte et le record.
    return (
      <Frame title="Ma série" to="/historique" size={size}>
        <p className="mt-auto flex items-center gap-1.5 pt-3 text-3xl font-bold leading-none tabular-nums">
          {flame}
          {current}
        </p>
        <p className="mt-1 text-sm leading-snug text-muted">{current > 1 ? 'séances' : 'séance'} d’affilée</p>
        <p className={`text-sm leading-snug ${dueToday ? 'font-semibold text-accent' : 'text-muted'}`}>
          {dueToday ? 'À faire aujourd’hui' : record}
        </p>
      </Frame>
    );
  }

  return (
    <Frame title="Séances d’affilée" to="/historique" size={size}>
      <div className="mt-2 flex items-center gap-2">
        {flame}
        <p>
          <span className="text-3xl font-bold tabular-nums">{current}</span>{' '}
          <span className="text-muted">{current > 1 ? 'séances' : 'séance'}</span>
        </p>
        <p className="ml-auto text-sm font-medium text-muted">{record}</p>
      </div>
      {recent.length > 0 && (
        <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Dernières séances, faites ou ratées">
          {recent.map((kind, index) => (
            <li
              key={index}
              aria-label={kind === 'done' ? 'Séance faite' : 'Séance ratée'}
              className={`size-3.5 rounded-full ${kind === 'done' ? 'bg-accent' : 'border-2 border-muted/60'}`}
            />
          ))}
        </ol>
      )}
      {keepBy && (
        <p className={`mt-2 text-sm ${dueToday ? 'font-semibold text-accent' : 'text-muted'}`}>
          {dueToday ? 'Séance à faire aujourd’hui' : `Prochaine séance au plus tard ${formatNearDay(keepBy, day)}`}
        </p>
      )}
    </Frame>
  );
}

// ---------- Mes objectifs ----------

/** Barre d'avancement d'un objectif : rouge en cours, dorée une fois atteint. */
export function GoalBar({ ratio, achieved, className = '' }: { ratio: number; achieved: boolean; className?: string }) {
  return (
    <span
      className={`block h-2.5 overflow-hidden rounded-full bg-white/10 ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
    >
      <span
        className={`block h-full rounded-full transition-[width] duration-500 ${achieved ? 'bg-gold' : 'bg-accent-bright'}`}
        style={{ width: `${Math.max(3, Math.round(ratio * 100))}%` }}
      />
    </span>
  );
}

/** Objectifs à montrer : ceux atteints ces derniers jours d'abord (pour fêter), puis ceux en cours. */
function goalsToShow(goals: GoalStatus[], day: string): GoalStatus[] {
  const fresh = goals.filter((g) => g.achievedOn !== null && daysBetween(g.achievedOn, day) <= 3);
  return [...fresh, ...goals.filter((g) => g.achievedOn === null)];
}

function GoalsWidget({ size, now, day }: { size: WidgetSize; now: number; day: string }) {
  const goals = useLive(() => getGoalStatuses(now), [day]);
  if (!goals) return <Frame title="Mes objectifs" size={size}>{null}</Frame>;
  const shown = goalsToShow(goals, day);

  if (shown.length === 0) {
    return (
      <Frame title="Mes objectifs" to={GOALS_PATH} size={size}>
        <p className="mt-auto flex items-center gap-2 pt-3 font-semibold text-accent">
          <IconTarget className="size-6 shrink-0" />
          {goals.length > 0 ? 'Un nouveau défi ?' : 'Fixer un objectif'}
        </p>
      </Frame>
    );
  }

  if (size === 'small') {
    const goal = shown[0];
    const achieved = goal.achievedOn !== null;
    return (
      <Frame title="Mes objectifs" to={GOALS_PATH} size={size}>
        <p className="mt-2 line-clamp-2 font-semibold leading-snug">{goal.title}</p>
        <p className="text-sm text-muted tabular-nums">{formatGoalTarget(goal.goal)}</p>
        <GoalBar ratio={goal.ratio} achieved={achieved} className="mt-auto" />
        <p className={`mt-1.5 flex items-center gap-1 text-sm font-semibold tabular-nums ${achieved ? 'text-gold' : ''}`}>
          {achieved && <IconTrophy className="size-4" />}
          {achieved ? 'Atteint !' : `${Math.round(goal.ratio * 100)} %`}
        </p>
      </Frame>
    );
  }

  const more = shown.length - 3;
  return (
    <Frame title="Mes objectifs" to={GOALS_PATH} size={size}>
      <ul className="mt-2 space-y-3">
        {shown.slice(0, 3).map((goal) => (
          <li key={goal.goal.id}>
            <div className="mb-1.5 flex items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate font-medium">{goal.title}</span>
              <span
                className={`flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums ${
                  goal.achievedOn ? 'text-gold' : ''
                }`}
              >
                {goal.achievedOn && <IconTrophy className="size-4" />}
                {formatGoalTarget(goal.goal)}
              </span>
            </div>
            <GoalBar ratio={goal.ratio} achieved={goal.achievedOn !== null} />
          </li>
        ))}
      </ul>
      {more > 0 && <p className="mt-2 text-sm text-muted">et {plural(more, 'autre objectif', 'autres objectifs')}</p>}
    </Frame>
  );
}
