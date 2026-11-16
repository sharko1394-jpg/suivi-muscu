import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  EQUIPMENT_LABELS,
  MUSCLES,
  MUSCLE_LABELS,
  listExercises,
  normalizeText,
  useLive,
  type Exercise,
  type Muscle,
} from '../data';
import { Button, Chip } from './components';
import { plural } from './format';
import { IconChevronRight, IconClose, IconPlus, IconSearch } from './icons';

/**
 * Liste des exercices avec recherche et filtre par muscle.
 * - avec `onPick` : on choisit un exercice (les masqués ne sont pas proposés) ;
 * - avec `linkTo` : chaque ligne mène à une page (bibliothèque).
 */
export function ExerciseBrowser({
  onPick,
  linkTo,
  onCreate,
}: {
  onPick?: (exercise: Exercise) => void;
  linkTo?: (exercise: Exercise) => string;
  /** Appelé quand on veut créer l'exercice cherché, introuvable dans la liste. */
  onCreate: (name: string) => void;
}) {
  const picking = onPick !== undefined;
  const all = useLive(() => listExercises({ includeArchived: true }), []);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = all?.filter((e) => e.archived).length ?? 0;

  const visible = useMemo(() => {
    const q = normalizeText(query);
    return (all ?? []).filter(
      (e) =>
        (!e.archived || (showArchived && !picking)) &&
        (muscle === 'all' || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) &&
        (q === '' || normalizeText(e.name).includes(q)),
    );
  }, [all, query, muscle, showArchived, picking]);

  const rowClass = 'flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-raised';

  const rowContent = (exercise: Exercise) => (
    <>
      <div className={`min-w-0 flex-1 ${exercise.archived ? 'opacity-60' : ''}`}>
        <p className="text-lg font-medium leading-snug">{exercise.name}</p>
        <p className="text-sm text-muted">
          {MUSCLE_LABELS[exercise.primaryMuscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
        </p>
      </div>
      {exercise.archived && <Badge tone="muted">Masqué</Badge>}
      {exercise.isCustom && <Badge tone="accent">Perso</Badge>}
      {picking ? (
        <IconPlus className="shrink-0 text-accent" />
      ) : (
        <IconChevronRight className="shrink-0 text-muted" />
      )}
    </>
  );

  return (
    <div className="space-y-3">
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
            {onPick ? (
              <button type="button" onClick={() => onPick(exercise)} className={rowClass}>
                {rowContent(exercise)}
              </button>
            ) : (
              <Link to={linkTo ? linkTo(exercise) : '#'} className={rowClass}>
                {rowContent(exercise)}
              </Link>
            )}
          </li>
        ))}
      </ul>

      {all !== undefined && visible.length === 0 && (
        <div className="space-y-3 py-6 text-center">
          <p className="text-muted">Aucun exercice ne correspond.</p>
          {query.trim() !== '' && (
            <Button variant="primary" onClick={() => onCreate(query.trim())}>
              Créer «&nbsp;{query.trim()}&nbsp;»
            </Button>
          )}
        </div>
      )}

      {!picking && archivedCount > 0 && (
        <Button variant="ghost" onClick={() => setShowArchived((v) => !v)}>
          {showArchived
            ? 'Cacher les exercices masqués'
            : `Afficher les exercices masqués (${archivedCount})`}
        </Button>
      )}
    </div>
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

/** Sélecteur plein écran, pour ajouter ou remplacer un exercice. */
export function ExercisePicker({
  open,
  title,
  doneLabel,
  onPick,
  onCreate,
  onClose,
}: {
  open: boolean;
  title: string;
  /** Texte du bouton de fermeture quand on peut choisir plusieurs exercices à la suite. */
  doneLabel?: string;
  onPick: (exercise: Exercise) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 mx-auto flex max-w-xl flex-col bg-black/55 backdrop-blur-2xl"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex items-center gap-2 border-b border-line/60 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <h2 className="min-w-0 flex-1 truncate text-2xl font-bold">{title}</h2>
        {doneLabel ? (
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 shrink-0 rounded-full bg-accent px-5 text-base font-semibold text-accent-ink active:brightness-90"
          >
            {doneLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-raised active:bg-line"
          >
            <IconClose />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <ExerciseBrowser onPick={onPick} onCreate={onCreate} />
      </div>
    </div>
  );
}
