import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  listHistory,
  localDate,
  monthWeeks,
  normalizeText,
  useLive,
  type HistoryEntry,
} from '../data';
import { Card, PageHeader } from '../ui/components';
import { SegmentedControl } from '../ui/controls';
import { formatDay, formatDuration, formatMonth, formatVolume, plural } from '../ui/format';
import { IconChevronLeft, IconChevronRight, IconSearch } from '../ui/icons';
import { summaryPath } from './SessionPage';

type View = 'list' | 'calendar';
const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function HistoryPage() {
  const history = useLive(() => listHistory(), []);
  const [view, setView] = useState<View>('list');
  const [query, setQuery] = useState('');

  /** Séances qui contiennent l'exercice cherché. */
  const matching = useMemo(() => {
    const q = normalizeText(query);
    if (q === '') return history ?? [];
    return (history ?? []).filter((entry) =>
      entry.exerciseNames.some((name) => normalizeText(name).includes(q)),
    );
  }, [history, query]);

  return (
    <>
      <PageHeader title="Historique" />
      <div className="space-y-4 p-4 pb-8">
        {history !== undefined && history.length === 0 ? (
          <Card>
            <p className="text-lg font-semibold">Aucune séance pour l’instant</p>
            <p className="text-muted">
              Tes séances terminées apparaîtront ici, avec tout ce que tu y as fait.
            </p>
          </Card>
        ) : (
          <>
            <SegmentedControl
              label="Présentation"
              value={view}
              options={[
                { value: 'list', label: 'Liste' },
                { value: 'calendar', label: 'Calendrier' },
              ]}
              onChange={setView}
            />

            <label className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-raised px-4 focus-within:border-accent">
              <IconSearch className="shrink-0 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Chercher un exercice"
                aria-label="Chercher les séances contenant un exercice"
                enterKeyHint="search"
                autoComplete="off"
                className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
              />
            </label>

            {query.trim() !== '' && history !== undefined && (
              <p className="px-1 text-sm text-muted">
                {plural(matching.length, 'séance')} avec «&nbsp;{query.trim()}&nbsp;»
              </p>
            )}

            {view === 'list' ? <ListView entries={matching} /> : <CalendarView entries={matching} />}
          </>
        )}
      </div>
    </>
  );
}

function SessionRows({ entries }: { entries: HistoryEntry[] }) {
  return (
    <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
      {entries.map(({ session, totals }) => (
        <li key={session.id} className="border-b border-line/60 last:border-b-0">
          <Link
            to={summaryPath(session.id)}
            className="flex min-h-18 items-center gap-3 px-4 py-3 active:bg-raised"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{session.workoutName}</p>
              <p className="text-sm text-muted first-letter:uppercase">
                {formatDay(session.date)} · {formatDuration(totals.durationSec)} ·{' '}
                {plural(totals.setCount, 'série')}
                {totals.volume > 0 ? ` · ${formatVolume(totals.volume)}` : ''}
              </p>
            </div>
            <IconChevronRight className="shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Séances regroupées par mois, les plus récentes en premier. */
function ListView({ entries }: { entries: HistoryEntry[] }) {
  const months = useMemo(() => {
    const groups: { key: string; label: string; entries: HistoryEntry[] }[] = [];
    for (const entry of entries) {
      const key = entry.session.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.entries.push(entry);
      else {
        const [year, month] = key.split('-').map(Number);
        groups.push({ key, label: formatMonth(year, month - 1), entries: [entry] });
      }
    }
    return groups;
  }, [entries]);

  if (entries.length === 0) return <p className="py-6 text-center text-muted">Aucune séance trouvée.</p>;

  return (
    <div className="space-y-6">
      {months.map((month) => (
        <section key={month.key} className="space-y-2">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted">
            {month.label} · {plural(month.entries.length, 'séance')}
          </h2>
          <SessionRows entries={month.entries} />
        </section>
      ))}
    </div>
  );
}

/** Un mois à la fois ; les jours avec séance sont en couleur. */
function CalendarView({ entries }: { entries: HistoryEntry[] }) {
  const today = localDate(Date.now());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.session.date);
      if (list) list.push(entry);
      else map.set(entry.session.date, [entry]);
    }
    return map;
  }, [entries]);

  const weeks = monthWeeks(cursor.year, cursor.month);
  const monthKey = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const inMonth = entries.filter((entry) => entry.session.date.startsWith(monthKey));
  const shown = selected ? (byDay.get(selected) ?? []) : inMonth;
  const isCurrentMonth = today.startsWith(monthKey);

  const move = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
    setSelected(null);
  };

  const arrow =
    'flex size-12 shrink-0 items-center justify-center rounded-full bg-raised active:bg-line disabled:opacity-35';

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} aria-label="Mois précédent" className={arrow}>
            <IconChevronLeft />
          </button>
          <p className="min-w-0 flex-1 text-center text-lg font-bold first-letter:uppercase">
            {formatMonth(cursor.year, cursor.month)}
          </p>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={isCurrentMonth}
            aria-label="Mois suivant"
            className={arrow}
          >
            <IconChevronRight />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_INITIALS.map((initial, index) => (
            <span key={index} className="py-1 text-xs font-semibold text-muted" aria-hidden="true">
              {initial}
            </span>
          ))}
          {weeks.flat().map((day, index) => {
            if (day === null) return <span key={index} />;
            const count = byDay.get(day)?.length ?? 0;
            const isSelected = day === selected;
            return (
              <button
                key={day}
                type="button"
                disabled={count === 0}
                onClick={() => setSelected(isSelected ? null : day)}
                aria-pressed={count > 0 ? isSelected : undefined}
                aria-label={`${formatDay(day)}${count > 0 ? `, ${plural(count, 'séance')}` : ''}`}
                className={`mx-auto flex size-11 items-center justify-center rounded-full text-base tabular-nums ${
                  count > 0
                    ? isSelected
                      ? 'bg-ink font-bold text-bg'
                      : 'bg-accent font-bold text-accent-ink active:brightness-90'
                    : 'text-muted'
                } ${day === today && !isSelected ? 'ring-2 ring-ink/70' : ''}`}
              >
                {Number(day.slice(8))}
              </button>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted">
          {selected
            ? `${formatDay(selected)} · touche à nouveau le jour pour revoir tout le mois`
            : `${plural(inMonth.length, 'séance')} ce mois-ci`}
        </p>
      </Card>

      {shown.length > 0 && <SessionRows entries={shown} />}
    </div>
  );
}
