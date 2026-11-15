import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../ui/components';
import { ExerciseBrowser } from '../ui/ExerciseBrowser';
import { IconPlus } from '../ui/icons';

/** Bibliothèque d'exercices : parcourir, chercher, créer, modifier. */
export function ExercisesPage() {
  const navigate = useNavigate();
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
      <div className="p-4">
        <ExerciseBrowser
          linkTo={(exercise) => `/reglages/exercices/${exercise.id}`}
          onCreate={(name) => navigate('/reglages/exercices/nouveau', { state: { name } })}
        />
      </div>
    </>
  );
}
