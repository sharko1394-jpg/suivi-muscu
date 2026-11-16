import { useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  EQUIPMENTS,
  EQUIPMENT_LABELS,
  MUSCLES,
  MUSCLE_LABELS,
  WEIGHT_STEPS,
  addPlannedExercise,
  addSessionExercise,
  createExercise,
  getExercise,
  replacePlannedExercise,
  setExerciseArchived,
  updateExercise,
  useLive,
  useSettings,
  type Equipment,
  type Exercise,
  type Muscle,
} from '../data';
import { Button, Card, Chip, PageHeader } from '../ui/components';
import { formatNumber, messageOf } from '../ui/format';
import { useToast } from '../ui/toast';

const LIST = '/reglages/exercices';

export function ExerciseFormPage() {
  const { id } = useParams();
  const location = useLocation();
  // { exercise: null } = création, ou exercice introuvable ; undefined = chargement en cours.
  const loaded = useLive(
    async () => ({ exercise: id ? ((await getExercise(id)) ?? null) : null }),
    [id],
  );

  if (loaded === undefined) return <PageHeader title="Exercice" backTo={LIST} />;

  if (id && loaded.exercise === null) {
    return (
      <>
        <PageHeader title="Exercice" backTo={LIST} />
        <p className="p-6 text-center text-muted">Cet exercice n’existe plus.</p>
      </>
    );
  }

  const state = location.state as FormState | null;
  return (
    <ExerciseForm
      key={id ?? 'nouveau'}
      exercise={loaded.exercise}
      suggestedName={state?.name ?? ''}
      thenAddTo={state?.thenAddTo ?? null}
      thenAddToSession={state?.thenAddToSession ?? null}
    />
  );
}

/** Ce que la page d'origine peut transmettre au formulaire de création. */
interface FormState {
  /** Nom déjà tapé dans la recherche. */
  name?: string;
  /** Séance du programme où placer l'exercice dès sa création (ajout ou remplacement). */
  thenAddTo?: { workoutId: string; replaceItemId: string | null };
  /** Séance en cours à laquelle ajouter l'exercice dès sa création. */
  thenAddToSession?: string;
}

function ExerciseForm({
  exercise,
  suggestedName,
  thenAddTo,
  thenAddToSession,
}: {
  exercise: Exercise | null;
  suggestedName: string;
  thenAddTo: FormState['thenAddTo'] | null;
  thenAddToSession: string | null;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const settings = useSettings();
  const [weightStep, setWeightStep] = useState<number | null>(exercise?.weightStep ?? null);

  const [name, setName] = useState(exercise?.name ?? suggestedName);
  const [primaryMuscle, setPrimaryMuscle] = useState<Muscle | ''>(exercise?.primaryMuscle ?? '');
  const [secondaryMuscles, setSecondaryMuscles] = useState<Muscle[]>(
    exercise?.secondaryMuscles ?? [],
  );
  const [equipment, setEquipment] = useState<Equipment | ''>(exercise?.equipment ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Retour à la liste ; si la page a été ouverte directement, on y va sans « reculer ».
  const leave = () => (location.key === 'default' ? navigate(LIST, { replace: true }) : navigate(-1));

  const toggleSecondary = (muscle: Muscle) => {
    setError(null);
    setSecondaryMuscles((current) =>
      current.includes(muscle) ? current.filter((m) => m !== muscle) : [...current, muscle],
    );
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (primaryMuscle === '') return setError('Choisis le groupe musculaire principal.');
    if (equipment === '') return setError('Choisis le type de matériel.');
    setBusy(true);
    setError(null);
    try {
      const input = { name, primaryMuscle, secondaryMuscles, equipment, weightStep };
      if (exercise) {
        await updateExercise(exercise.id, input);
        toast('Exercice modifié');
      } else {
        const created = await createExercise(input);
        if (thenAddToSession) {
          await addSessionExercise(thenAddToSession, created.id);
          toast('Exercice créé et ajouté à la séance');
        } else if (thenAddTo?.replaceItemId) {
          await replacePlannedExercise(thenAddTo.workoutId, thenAddTo.replaceItemId, created.id);
          toast('Exercice créé et mis à la place de l’ancien');
        } else if (thenAddTo) {
          await addPlannedExercise(thenAddTo.workoutId, created.id);
          toast('Exercice créé et ajouté à la séance');
        } else {
          toast('Exercice créé');
        }
      }
      leave();
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  async function toggleArchived() {
    if (!exercise) return;
    setBusy(true);
    try {
      await setExerciseArchived(exercise.id, !exercise.archived);
      toast(exercise.archived ? 'Exercice réaffiché' : 'Exercice masqué');
      leave();
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  const fieldClass =
    'h-14 w-full rounded-2xl border border-line bg-raised px-4 text-ink outline-none placeholder:text-muted focus:border-accent';

  return (
    <>
      <PageHeader
        title={exercise ? 'Modifier l’exercice' : 'Nouvel exercice'}
        backTo={LIST}
        // Venu d'une séance : la flèche y ramène, pas à la bibliothèque.
        onBack={thenAddTo || thenAddToSession ? leave : undefined}
      />
      {/* Dès qu'un champ change, le message d'erreur précédent n'a plus lieu d'être. */}
      <form
        onSubmit={save}
        onChange={() => setError(null)}
        className="space-y-6 p-4 pb-8"
        noValidate
      >
        <Field label="Nom" htmlFor="exercise-name">
          <input
            id="exercise-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex. Développé couché (barre)"
            maxLength={80}
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            className={fieldClass}
          />
        </Field>

        <Field label="Groupe musculaire principal" htmlFor="exercise-muscle">
          <select
            id="exercise-muscle"
            value={primaryMuscle}
            onChange={(event) => {
              const value = event.target.value as Muscle;
              setPrimaryMuscle(value);
              setSecondaryMuscles((current) => current.filter((m) => m !== value));
            }}
            className={fieldClass}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Muscles secondaires (facultatif)">
          <div className="flex flex-wrap gap-2">
            {MUSCLES.filter((m) => m !== primaryMuscle).map((m) => (
              <Chip key={m} selected={secondaryMuscles.includes(m)} onClick={() => toggleSecondary(m)}>
                {MUSCLE_LABELS[m]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Matériel" htmlFor="exercise-equipment">
          <select
            id="exercise-equipment"
            value={equipment}
            onChange={(event) => setEquipment(event.target.value as Equipment)}
            className={fieldClass}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {EQUIPMENTS.map((e) => (
              <option key={e} value={e}>
                {EQUIPMENT_LABELS[e]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Pas de charge des boutons − et +" htmlFor="exercise-step">
          <select
            id="exercise-step"
            value={weightStep ?? ''}
            onChange={(event) =>
              setWeightStep(event.target.value === '' ? null : Number(event.target.value))
            }
            className={fieldClass}
          >
            <option value="">
              Réglage général{settings ? ` (${formatNumber(settings.weightStep)} kg)` : ''}
            </option>
            {WEIGHT_STEPS.map((step) => (
              <option key={step} value={step}>
                {formatNumber(step)} kg
              </option>
            ))}
          </select>
        </Field>

        {error && (
          <p role="alert" className="rounded-2xl border border-danger/50 bg-danger/10 p-3 text-danger">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={busy}>
          {exercise ? 'Enregistrer' : 'Créer l’exercice'}
        </Button>

        {exercise && (
          <Card className="space-y-3">
            <Button onClick={toggleArchived} disabled={busy}>
              {exercise.archived ? 'Réafficher cet exercice' : 'Masquer cet exercice'}
            </Button>
          </Card>
        )}
      </form>
    </>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block px-1 font-semibold">
          {label}
        </label>
      ) : (
        <p className="px-1 font-semibold">{label}</p>
      )}
      {children}
    </div>
  );
}
