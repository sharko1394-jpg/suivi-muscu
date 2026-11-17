import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  EQUIPMENT_LABELS,
  LIBRARY_SORTS,
  MUSCLES,
  MUSCLE_LABELS,
  getLibrary,
  normalizeText,
  sortLibrary,
  useLive,
  type LibraryEntry,
  type LibrarySort,
  type Muscle,
} from '../data';
import { Chip, PageHeader, sectionTitleClass } from '../ui/components';
import { formatAgo, formatKg, plural } from '../ui/format';
import { IconChevronRight, IconPlus, IconSearch } from '../ui/icons';
import { libraryExercisePath } from './paths';

// Choix gardés le temps de l'ouverture de l'appli : en revenant d'une fiche, la liste est comme on l'a laissée.
let lastSort: LibrarySort = 'frequent';
let lastMuscle: Muscle | 'all' = 'all';
let lastQuery = '';

const rowsClass = 'overflow-hidden rounded-3xl border border-line bg-surface';
/** Rangée de pastilles qu'on fait glisser ; les bords s'estompent. */
const chipsRow =
  'no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1.5rem),transparent)]';

/** Le chiffre affiché à droite de chaque exercice, selon le tri choisi. */
function metric(entry: LibraryEntry, sort: LibrarySort): { text: string; tone?: 'accent' | 'gold' } | null {
  if (entry.sessions === 0) return null;
  switch (sort) {
    case 'frequent':
      return { text: plural(entry.sessions, 'séance') };
    case 'strongest':
      if (entry.bestE1rm !== null) return { text: `1RM ≈ ${formatKg(Math.round(entry.bestE1rm))}`, tone: 'accent' };
      if (entry.maxWeight !== null && entry.maxWeight > 0) return { text: formatKg(entry.maxWeight), tone: 'accent' };
      return { text: `${entry.maxReps ?? 0} rép.` };
    case 'progress':
      if (entry.progress === null) return { text: '—' };
      return {
        text: `${entry.progress > 0 ? '+' : ''}${Math.round(entry.progress * 100)} %`,
        tone: entry.progress > 0 ? 'accent' : undefined,
      };
    case 'recent':
      return { text: formatAgo(new Date(`${entry.lastDate}T12:00:00`).getTime()) };
    case 'name':
      return null;
  }
}

function Row({ entry, sort }: { entry: LibraryEntry; sort: LibrarySort }) {
  const { exercise } = entry;
  const value = metric(entry, sort);
  return (
    <li className="border-b border-line/60 last:border-b-0">
      <Link
        to={libraryExercisePath(exercise.id)}
        className="flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-raised"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-medium leading-snug">{exercise.name}</span>
          <span className="block text-sm text-muted">
            {MUSCLE_LABELS[exercise.primaryMuscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
            {exercise.isCustom ? ' · perso' : ''}
          </span>
        </span>
        {value && (
          <span
            className={`shrink-0 text-right text-sm font-semibold tabular-nums ${
              value.tone === 'accent' ? 'text-accent' : value.tone === 'gold' ? 'text-gold' : 'text-muted'
            }`}
          >
            {value.text}
          </span>
        )}
        <IconChevronRight className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}

/** Onglet Bibliothèque : tous les exercices, à trier et filtrer ; chacun ouvre sa fiche. */
export default function LibraryPage() {
  const entries = useLive(() => getLibrary(), []);
  const [sort, setSort] = useState<LibrarySort>(lastSort);
  const [muscle, setMuscle] = useState<Muscle | 'all'>(lastMuscle);
  const [query, setQuery] = useState(lastQuery);
  lastSort = sort;
  lastMuscle = muscle;
  lastQuery = query;

  const { done, never } = useMemo(() => {
    const q = normalizeText(query);
    const visible = (entries ?? []).filter(
      (e) =>
        (muscle === 'all' || e.exercise.primaryMuscle === muscle || e.exercise.secondaryMuscles.includes(muscle)) &&
        (q === '' || normalizeText(e.exercise.name).includes(q)),
    );
    const sorted = sortLibrary(visible, sort);
    // A → Z : une seule liste. Sinon, les exercices jamais faits viennent après, à part.
    if (sort === 'name') return { done: sorted, never: [] };
    return { done: sorted.filter((e) => e.sessions > 0), never: sorted.filter((e) => e.sessions === 0) };
  }, [entries, query, muscle, sort]);

  const count = done.length + never.length;
  const practised = (entries ?? []).filter((e) => e.sessions > 0).length;

  return (
    <>
      <PageHeader
        title="Bibliothèque"
        subtitle={entries ? `${plural(entries.length, 'exercice')} · ${practised} déjà pratiqué${practised > 1 ? 's' : ''}` : undefined}
        action={
          <Link
            to="/reglages/exercices/nouveau"
            aria-label="Créer un exercice"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-raised text-ink active:bg-line"
          >
            <IconPlus />
          </Link>
        }
      />
      <div className="space-y-4 p-4 pb-8">
        <label className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-raised px-4 focus-within:border-accent">
          <IconSearch className="shrink-0 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher un exercice"
            aria-label="Chercher un exercice"
            enterKeyHint="search"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
          />
        </label>

        <div className="space-y-2">
          <p className={sectionTitleClass}>Trier</p>
          <div className={chipsRow} role="group" aria-label="Trier les exercices">
            {LIBRARY_SORTS.map((option) => (
              <Chip key={option.value} selected={option.value === sort} onClick={() => setSort(option.value)}>
                {option.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className={sectionTitleClass}>Muscle</p>
          <div className={chipsRow} role="group" aria-label="Filtrer par muscle">
            <Chip selected={muscle === 'all'} onClick={() => setMuscle('all')}>
              Tous
            </Chip>
            {MUSCLES.map((m) => (
              <Chip key={m} selected={muscle === m} onClick={() => setMuscle(m)}>
                {MUSCLE_LABELS[m]}
              </Chip>
            ))}
          </div>
        </div>

        {entries !== undefined && count === 0 && (
          <p className="py-6 text-center text-muted">Aucun exercice ne correspond.</p>
        )}

        {done.length > 0 && (
          <ul className={rowsClass}>
            {done.map((entry) => (
              <Row key={entry.exercise.id} entry={entry} sort={sort} />
            ))}
          </ul>
        )}

        {never.length > 0 && (
          <section className="space-y-2.5 pt-2">
            <h2 className={sectionTitleClass}>Pas encore pratiqués · {never.length}</h2>
            <ul className={rowsClass}>
              {never.map((entry) => (
                <Row key={entry.exercise.id} entry={entry} sort={sort} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
