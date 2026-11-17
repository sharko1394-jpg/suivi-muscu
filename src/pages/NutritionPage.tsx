import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  GOAL_TIPS,
  JOB_LABELS,
  NUTRITION_GOAL_LABELS,
  PACE_RANGE,
  addDays,
  addFoodEntry,
  foodFor,
  getNutritionReport,
  listRecentFoods,
  localDate,
  removeFoodEntry,
  searchFoods,
  setDaySteps,
  setNutritionGoal,
  useLive,
  type Food,
  type FoodEntry,
  type NutritionGoal,
  type NutritionReport,
} from '../data';
import { Button, Card, PageHeader, Section, buttonClass, sectionTitleClass } from '../ui/components';
import { SegmentedControl, Stepper } from '../ui/controls';
import { formatDay, formatNumber, messageOf } from '../ui/format';
import { useNow } from '../ui/hooks';
import { IconChevronLeft, IconChevronRight, IconClose, IconPlus, IconSearch } from '../ui/icons';
import { Sheet } from '../ui/overlays';
import { useToast } from '../ui/toast';
import { PROFILE_PATH } from './paths';

const kcal = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} kcal`;
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value))}`;

/** Onglet Nutrition : ce que je dépense, ce que je mange, et ce qu'il faut pour mon objectif. */
export default function NutritionPage() {
  const now = useNow(60_000);
  const today = localDate(now);
  const [date, setDate] = useState(today);
  const report = useLive(() => getNutritionReport(date), [date, today]);
  const [adding, setAdding] = useState(false);
  const [editingSteps, setEditingSteps] = useState(false);
  const arrow = 'flex size-12 shrink-0 items-center justify-center rounded-full bg-raised active:bg-line disabled:opacity-35';

  return (
    <>
      <PageHeader title="Nutrition" />
      <div className="space-y-6 p-4 pb-8">
        <SegmentedControl<NutritionGoal>
          label="Objectif"
          value={report?.goal ?? 'maintain'}
          options={(Object.keys(NUTRITION_GOAL_LABELS) as NutritionGoal[]).map((goal) => ({
            value: goal,
            label: goal === 'bulk' ? 'Masse' : NUTRITION_GOAL_LABELS[goal],
          }))}
          onChange={(goal) => void setNutritionGoal(goal)}
        />

        <nav className="flex items-center gap-2" aria-label="Changer de jour">
          <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent" className={arrow}>
            <IconChevronLeft />
          </button>
          <p className="min-w-0 flex-1 text-center font-semibold first-letter:uppercase">
            {date === today ? 'Aujourd’hui' : formatDay(date)}
          </p>
          <button
            type="button"
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= today}
            aria-label="Jour suivant"
            className={arrow}
          >
            <IconChevronRight />
          </button>
        </nav>

        {report && report.missing.length > 0 && (
          <Card className="space-y-3">
            <p className="text-lg font-semibold">Complète ton profil</p>
            <p className="text-muted">Il manque : {report.missing.join(', ')}.</p>
            <Link to={PROFILE_PATH} className={buttonClass('primary')}>
              Ouvrir mon profil
            </Link>
          </Card>
        )}

        {report && <Intake report={report} onAdd={() => setAdding(true)} />}
        {report?.energy && <Expenditure report={report} onSteps={() => setEditingSteps(true)} />}
        {report && <Pace report={report} />}
      </div>

      {adding && <AddFoodSheet date={date} onClose={() => setAdding(false)} />}
      {editingSteps && report && (
        <StepsSheet date={date} report={report} onClose={() => setEditingSteps(false)} />
      )}
    </>
  );
}

// ---------- Ce que je mange ----------

function MacroBar({ label, value, target, unit = 'g' }: { label: string; value: number; target: number; unit?: string }) {
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted tabular-nums">
          <span className="font-semibold text-ink">{Math.round(value)}</span> / {Math.round(target)} {unit}
        </span>
      </div>
      <span className="block h-2 overflow-hidden rounded-full bg-white/10">
        <span
          className={`block h-full rounded-full ${value > target * 1.05 ? 'bg-gold' : 'bg-accent-bright'}`}
          style={{ width: `${Math.max(2, ratio * 100)}%` }}
        />
      </span>
    </div>
  );
}

function Intake({ report, onAdd }: { report: NutritionReport; onAdd: () => void }) {
  const { targets, eaten, day } = report;
  return (
    <>
      {targets && (
        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5">
          <span className="pointer-events-none absolute -right-14 -top-16 size-44 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative space-y-4">
            <div className="text-center">
              <p className={sectionTitleClass}>{eaten.kcal <= targets.kcal ? 'Il reste à manger' : 'Dépassé de'}</p>
              <p className="mt-1 text-5xl font-bold leading-none tabular-nums text-accent">
                {Math.abs(targets.kcal - eaten.kcal).toLocaleString('fr-FR')}
                <span className="ml-1 text-lg font-semibold text-muted">kcal</span>
              </p>
              <p className="mt-2 text-sm text-muted tabular-nums">
                Mangé {kcal(eaten.kcal)} sur {kcal(targets.kcal)} · {NUTRITION_GOAL_LABELS[report.goal].toLowerCase()}
              </p>
            </div>
            <MacroBar label="Calories" value={eaten.kcal} target={targets.kcal} unit="kcal" />
            <MacroBar label="Protéines" value={eaten.protein} target={targets.protein} />
            <MacroBar label="Glucides" value={eaten.carbs} target={targets.carbs} />
            <MacroBar label="Lipides" value={eaten.fat} target={targets.fat} />
          </div>
        </div>
      )}

      <Section title="Ce que j’ai mangé">
        {day.foods.length > 0 && (
          <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
            {day.foods.map((food) => (
              <FoodRow key={food.id} date={report.date} food={food} />
            ))}
          </ul>
        )}
        <Button variant={day.foods.length === 0 ? 'primary' : 'secondary'} onClick={onAdd}>
          <IconPlus className="size-5" />
          Ajouter un aliment
        </Button>
      </Section>
    </>
  );
}

function FoodRow({ date, food }: { date: string; food: FoodEntry }) {
  const toast = useToast();
  const details = [
    food.grams ? `${food.grams} g` : null,
    food.protein > 0 ? `P ${formatNumber(food.protein)}` : null,
    food.carbs > 0 ? `G ${formatNumber(food.carbs)}` : null,
    food.fat > 0 ? `L ${formatNumber(food.fat)}` : null,
  ].filter(Boolean);
  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-line/60 py-2 pl-4 pr-1 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{food.name}</span>
        {details.length > 0 && <span className="block text-sm text-muted tabular-nums">{details.join(' · ')}</span>}
      </span>
      <span className="shrink-0 font-semibold tabular-nums">{food.kcal}</span>
      <button
        type="button"
        onClick={() => void removeFoodEntry(date, food.id).then(() => toast(`${food.name} retiré`))}
        aria-label={`Retirer ${food.name}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-raised"
      >
        <IconClose className="size-5" />
      </button>
    </li>
  );
}

// ---------- Ce que je dépense ----------

function Line({ label, detail, value, strong = false, onClick }: { label: string; detail?: string; value: string; strong?: boolean; onClick?: () => void }) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block ${strong ? 'text-lg font-bold' : 'font-medium'}`}>{label}</span>
        {detail && <span className="block text-sm text-muted">{detail}</span>}
      </span>
      <span className={`shrink-0 tabular-nums ${strong ? 'text-lg font-bold' : 'font-semibold'}`}>{value}</span>
      {onClick && <IconChevronRight className="size-5 shrink-0 text-muted" />}
    </>
  );
  const className = 'flex min-h-14 w-full items-center gap-3 border-b border-line/60 px-4 py-2 text-left last:border-b-0';
  return onClick ? (
    <li>
      <button type="button" onClick={onClick} className={`${className} active:bg-raised`}>
        {content}
      </button>
    </li>
  ) : (
    <li className={className}>{content}</li>
  );
}

function Expenditure({ report, onSteps }: { report: NutritionReport; onSteps: () => void }) {
  const energy = report.energy!;
  return (
    <Section title="Ma dépense du jour">
      <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
        <Line label="Métabolisme de base" detail="Ce que ton corps dépense au repos" value={kcal(energy.bmr)} />
        <Line label="Vie quotidienne" detail={`Travail ${JOB_LABELS[report.profile.job].toLowerCase()}`} value={kcal(energy.daily)} />
        <Line
          label="Pas"
          detail={`${energy.steps.toLocaleString('fr-FR')} pas · ${report.day.steps === null ? 'ta moyenne' : 'notés ce jour'}`}
          value={kcal(energy.stepsKcal)}
          onClick={onSteps}
        />
        {energy.workouts.length === 0 ? (
          <Line label="Séances" detail="Aucune séance ce jour" value={kcal(0)} />
        ) : (
          energy.workouts.map((workout) => (
            <li key={workout.sessionId} className="border-b border-line/60 last:border-b-0">
              <details className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 active:bg-raised">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">Séance · {workout.name}</span>
                    <span className="block text-sm text-muted">Détail par exercice</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{kcal(workout.kcal)}</span>
                  <IconChevronRight className="size-5 shrink-0 text-muted transition-transform group-open:rotate-90" />
                </summary>
                <ul className="space-y-1.5 px-4 pb-3">
                  {workout.exercises.map((exercise) => (
                    <li key={exercise.exerciseId} className="flex items-baseline gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate text-muted">{exercise.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{kcal(exercise.kcal)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))
        )}
        <Line label="Digestion" detail="Environ 10 % de la dépense" value={kcal(energy.digestion)} />
        <Line label="Total" value={kcal(energy.total)} strong />
      </ul>
      <p className="px-1 text-sm text-muted">Estimations : aucune appli ne mesure exactement les calories.</p>
    </Section>
  );
}

// ---------- Mon rythme et conseils ----------

function Pace({ report }: { report: NutritionReport }) {
  const { goal, trend, advice } = report;
  const [min, max] = PACE_RANGE[goal];
  const range = `${signed(min)} à ${signed(max)} % par semaine`;
  let message: ReactNode;
  if (advice.status === 'unknown') {
    message = 'Pèse-toi 2 à 3 fois par semaine, le matin : ton rythme apparaîtra après une semaine.';
  } else if (advice.status === 'good') {
    message = <span className="font-semibold text-accent">Bon rythme, continue comme ça.</span>;
  } else {
    message = (
      <span className="font-semibold text-gold">
        {advice.adjust > 0 ? 'Mange environ 150 kcal de plus par jour.' : 'Mange environ 150 kcal de moins par jour.'}
      </span>
    );
  }
  return (
    <Section title={`Mon rythme · ${NUTRITION_GOAL_LABELS[goal].toLowerCase()}`}>
      <Card className="space-y-2">
        <p className="text-2xl font-bold tabular-nums">
          {trend === null ? '—' : `${signed(trend)} %`}
          <span className="ml-1 text-base font-semibold text-muted">par semaine</span>
        </p>
        <p className="text-sm text-muted">Conseillé : {range}</p>
        <p>{message}</p>
      </Card>
      <Card>
        <ul className="space-y-2.5">
          {GOAL_TIPS[goal].map((tip) => (
            <li key={tip} className="flex gap-2.5 leading-snug">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-bright" />
              {tip}
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

// ---------- Ajouter un aliment ----------

const input =
  'h-13 w-full min-w-0 rounded-2xl border border-line bg-raised px-4 text-ink outline-none placeholder:text-muted focus:border-accent';

function AddFoodSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'list' | 'free'>('list');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Food | null>(null);
  const [grams, setGrams] = useState(100);
  const recent = useLive(() => listRecentFoods(localDate(Date.now())), []);
  const [free, setFree] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  const [error, setError] = useState<string | null>(null);

  const add = async (entry: Parameters<typeof addFoodEntry>[1]) => {
    try {
      await addFoodEntry(date, entry);
      toast(`${entry.name} ajouté`);
      onClose();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const number = (text: string) => (text.trim() === '' ? undefined : Number(text.replace(',', '.')));
  const foods = searchFoods(query);
  const values = chosen ? foodFor(chosen, grams) : null;

  return (
    <Sheet open title="Ajouter un aliment" onClose={onClose}>
      <div className="space-y-4">
        <SegmentedControl
          label="Façon d’ajouter"
          value={mode}
          options={[
            { value: 'list', label: 'Liste d’aliments' },
            { value: 'free', label: 'Saisie libre' },
          ]}
          onChange={(value) => {
            setMode(value);
            setError(null);
          }}
        />

        {mode === 'list' && chosen && values && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-lg font-bold">{chosen.name}</p>
              <button type="button" onClick={() => setChosen(null)} className="min-h-11 px-2 text-sm font-semibold text-muted underline underline-offset-4">
                Changer
              </button>
            </div>
            <Stepper
              label="Quantité"
              value={`${grams} g`}
              onDecrement={() => setGrams((g) => Math.max(5, g - (g > 100 ? 25 : 10)))}
              onIncrement={() => setGrams((g) => Math.min(2000, g + (g >= 100 ? 25 : 10)))}
              canDecrement={grams > 5}
            />
            <p className="rounded-2xl bg-raised px-4 py-3 text-center tabular-nums">
              <span className="text-xl font-bold">{values.kcal} kcal</span>
              <span className="block text-sm text-muted">
                Protéines {formatNumber(values.protein)} g · Glucides {formatNumber(values.carbs)} g · Lipides {formatNumber(values.fat)} g
              </span>
            </p>
            <Button variant="primary" onClick={() => void add({ name: chosen.name, grams, ...values })}>
              Ajouter
            </Button>
          </div>
        )}

        {mode === 'list' && !chosen && (
          <div className="space-y-3">
            <label className="flex h-13 items-center gap-3 rounded-2xl border border-line bg-raised px-4 focus-within:border-accent">
              <IconSearch className="shrink-0 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Chercher un aliment"
                aria-label="Chercher un aliment"
                autoComplete="off"
                enterKeyHint="search"
                className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
              />
            </label>
            {query.trim() === '' && recent && recent.length > 0 && (
              <div className="space-y-2">
                <p className={sectionTitleClass}>Récents</p>
                <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
                  {recent.map((food, index) => (
                    <li key={index} className="border-b border-line/60 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => void add(food)}
                        className="flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left active:bg-raised"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">{food.name}</span>
                        <span className="shrink-0 text-sm text-muted tabular-nums">
                          {food.grams ? `${food.grams} g · ` : ''}
                          {food.kcal} kcal
                        </span>
                        <IconPlus className="size-5 shrink-0 text-accent" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {query.trim() === '' && <p className={sectionTitleClass}>Aliments</p>}
            <ul className="overflow-hidden rounded-3xl border border-line bg-surface empty:hidden">
              {foods.map((food) => (
                <li key={food.name} className="border-b border-line/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(food);
                      setGrams(food.portion);
                    }}
                    className="flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left active:bg-raised"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{food.name}</span>
                    <span className="shrink-0 text-sm text-muted tabular-nums">{food.kcal} kcal / 100 g</span>
                  </button>
                </li>
              ))}
            </ul>
            {foods.length === 0 && (
              <Button onClick={() => { setMode('free'); setFree((f) => ({ ...f, name: query.trim() })); }}>
                Saisir « {query.trim()} » à la main
              </Button>
            )}
          </div>
        )}

        {mode === 'free' && (
          <div className="space-y-3">
            <input
              type="text"
              value={free.name}
              onChange={(event) => setFree({ ...free, name: event.target.value })}
              placeholder="Nom (ex. Repas du midi)"
              aria-label="Nom"
              maxLength={60}
              className={input}
            />
            <input
              type="text"
              inputMode="decimal"
              value={free.kcal}
              onChange={(event) => setFree({ ...free, kcal: event.target.value })}
              placeholder="Calories (kcal)"
              aria-label="Calories, en kcal"
              className={input}
            />
            <div className="grid grid-cols-3 gap-2">
              {(['protein', 'carbs', 'fat'] as const).map((key) => (
                <input
                  key={key}
                  type="text"
                  inputMode="decimal"
                  value={free[key]}
                  onChange={(event) => setFree({ ...free, [key]: event.target.value })}
                  placeholder={key === 'protein' ? 'Protéines' : key === 'carbs' ? 'Glucides' : 'Lipides'}
                  aria-label={`${key === 'protein' ? 'Protéines' : key === 'carbs' ? 'Glucides' : 'Lipides'}, en g (facultatif)`}
                  className={`${input} px-3 text-center`}
                />
              ))}
            </div>
            <Button
              variant="primary"
              disabled={free.name.trim() === '' || free.kcal.trim() === ''}
              onClick={() =>
                void add({
                  name: free.name,
                  kcal: number(free.kcal) ?? Number.NaN,
                  protein: number(free.protein),
                  carbs: number(free.carbs),
                  fat: number(free.fat),
                })
              }
            >
              Ajouter
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

// ---------- Pas du jour ----------

function StepsSheet({ date, report, onClose }: { date: string; report: NutritionReport; onClose: () => void }) {
  const average = report.profile.stepsPerDay;
  const [steps, setSteps] = useState(report.day.steps ?? average);
  const save = (value: number | null) => void setDaySteps(date, value).then(onClose);
  return (
    <Sheet open title="Pas de la journée" onClose={onClose}>
      <div className="space-y-4">
        <Stepper
          label="Pas"
          value={steps.toLocaleString('fr-FR')}
          onDecrement={() => setSteps((s) => Math.max(0, s - 500))}
          onIncrement={() => setSteps((s) => Math.min(100_000, s + 500))}
          canDecrement={steps > 0}
        />
        <Button variant="primary" onClick={() => save(steps)}>
          Enregistrer
        </Button>
        {report.day.steps !== null && (
          <Button variant="ghost" onClick={() => save(null)}>
            Revenir à ma moyenne ({average.toLocaleString('fr-FR')})
          </Button>
        )}
      </div>
    </Sheet>
  );
}
