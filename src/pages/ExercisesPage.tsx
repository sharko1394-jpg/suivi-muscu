import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  EQUIPMENT_LABELS,
  MUSCLES,
  MUSCLE_LABELS,
  listExercises,
  normalizeText,
  useLive,
  type Muscle,
} from '../data';
import { Button, Chip, PageHeader } from '../ui/components';
import { plural } from '../ui/format';
import { IconChevronRight, IconPlus, IconSearch } from '../ui/icons';

export function ExercisesPage() {
  const navigate = useNavigate();
  const all = useLive(() => listExercises({ includeArchived: true }), []);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = all?.filter((e) => e.archived).length ?? 0;

  const visible = useMemo(() => {
    const q = normalizeText(query);
    return (all ?? []).filter(
      (e) =>
        (showArchived || !e.archived) &&
        (muscle === 'all' || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) &&
        (q === '' || normalizeText(e.name).includes(q)),
    );
  }, [all, query, muscle, showArchived]);

  const createFromSearch = () =>
    navigate('/reglages/exercices/nouveau', { state: { name: query.trim() } });

  return (
    <>
      <PageHeader
        title="Exercices"
        backTo="/reglages"
        action={
          <Link
            to="/reglages/exercices/nouveau"
            aria-label="Créer un exercice"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink active:brightness-90"
          >
            <IconPlus />
          </Link>
        }
      />

      <div className="space-y-3 p-4">
        <label className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-raised px-4 focus-within:border-accent">
          <IconSearch className="shrink-0 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher un exercice"
            aria-label="Chercher un exercice"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
          />
        </label>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip selected={muscle === 'all'} onClick={() => setMuscle('all')}>
            Tous
          </Chip>
          {MUSCLES.map((m) => (
            <Chip key={m} selected={muscle === m} onClick={() => setMuscle(m)}>
              {MUSCLE_LABELS[m]}
            </Chip>
          ))}
        </div>

        {all !== undefined && (
          <p className="px-1 text-sm text-muted">{plural(visible.length, 'exercice')}</p>
        )}

        <ul className="overflow-hidden rounded-3xl border border-line bg-surface empty:hidden">
          {visible.map((exercise) => (
            <li key={exercise.id} className="border-b border-line/60 last:border-b-0">
              <Link
                to={`/reglages/exercices/${exercise.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-raised"
              >
                <div className={`min-w-0 flex-1 ${exercise.archived ? 'opacity-60' : ''}`}>
                  <p className="text-lg font-medium leading-snug">{exercise.name}</p>
                  <p className="text-sm text-muted">
                    {MUSCLE_LABELS[exercise.primaryMuscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
                  </p>
                </div>
                {exercise.archived && <Badge tone="muted">Masqué</Badge>}
                {exercise.isCustom && <Badge tone="accent">Perso</Badge>}
                <IconChevronRight className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>

        {all !== undefined && visible.length === 0 && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-muted">Aucun exercice ne correspond.</p>
            {query.trim() !== '' && (
              <Button variant="primary" onClick={createFromSearch}>
                Créer «&nbsp;{query.trim()}&nbsp;»
              </Button>
            )}
          </div>
        )}

        {archivedCount > 0 && (
          <Button variant="ghost" onClick={() => setShowArchived((v) => !v)}>
            {showArchived
              ? 'Cacher les exercices masqués'
              : `Afficher les exercices masqués (${archivedCount})`}
          </Button>
        )}
      </div>
    </>
  );
}

function Badge({ tone, children }: { tone: 'accent' | 'muted'; children: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        tone === 'accent' ? 'border-accent/60 text-accent' : 'border-line text-muted'
      }`}
    >
      {children}
    </span>
  );
}
