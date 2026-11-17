import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { formatNumber } from './format';
import { IconMinus, IconMore, IconPlus } from './icons';

const roundButton =
  'flex size-12 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-ink select-none active:bg-line disabled:opacity-35';

// ---------- Boutons − / + ----------

/** Réglage d'une valeur aux boutons − et +, sans clavier. */
export function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
  canDecrement = true,
  canIncrement = true,
}: {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement?: boolean;
  canIncrement?: boolean;
}) {
  // Le nom en petit au-dessus de la valeur, les boutons à droite : le nom tient sur une ligne,
  // et les boutons − et + restent alignés d'une ligne à l'autre.
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-muted">{label}</p>
        <p className="mt-0.5 whitespace-nowrap text-xl font-bold leading-snug tabular-nums" aria-live="polite">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onDecrement}
        disabled={!canDecrement}
        aria-label={`${label} : diminuer`}
        className={roundButton}
      >
        <IconMinus />
      </button>
      <button
        type="button"
        onClick={onIncrement}
        disabled={!canIncrement}
        aria-label={`${label} : augmenter`}
        className={roundButton}
      >
        <IconPlus />
      </button>
    </div>
  );
}

// ---------- Charge en kg ----------

function parseWeight(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Charge facultative : boutons − / + au pas choisi, ou saisie directe. Vide = aucune charge. */
export function WeightField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number | null;
  step: number;
  onChange: (value: number | null) => void;
}) {
  const toText = (v: number | null) => (v === null ? '' : formatNumber(v));
  const [text, setText] = useState(toText(value));
  // Dernière valeur envoyée : permet de ne pas réécrire le champ pendant la frappe,
  // tout en reprenant la valeur enregistrée si elle a été corrigée (bornes, arrondi).
  const sent = useRef(value);

  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setText(toText(value));
    }
  }, [value]);

  const commit = (next: number | null) => {
    sent.current = next;
    onChange(next);
  };

  const nudge = (direction: 1 | -1) => {
    const next = Math.max(0, Math.round(((value ?? 0) + direction * step) * 100) / 100);
    setText(toText(next));
    commit(next);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Même présentation que les autres réglages : le nom en petit, à gauche. */}
      <span className="min-w-0 flex-1 text-sm font-medium leading-tight text-muted">{label}</span>
      <button
        type="button"
        onClick={() => nudge(-1)}
        disabled={value === null || value <= 0}
        aria-label={`${label} : diminuer de ${formatNumber(step)} kg`}
        className={roundButton}
      >
        <IconMinus />
      </button>
      <div className="relative w-24">
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(event) => {
            const raw = event.target.value;
            setText(raw);
            if (raw.trim() === '') commit(null);
            else {
              const parsed = parseWeight(raw);
              if (parsed !== null) commit(parsed);
            }
          }}
          onBlur={() => setText(toText(value))}
          aria-label={`${label}, en kg`}
          placeholder="—"
          autoComplete="off"
          enterKeyHint="done"
          className="h-13 w-full rounded-2xl border border-line bg-black/30 pl-2 pr-8 text-center text-xl font-bold tabular-nums text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">
          kg
        </span>
      </div>
      <button
        type="button"
        onClick={() => nudge(1)}
        aria-label={`${label} : augmenter de ${formatNumber(step)} kg`}
        className={roundButton}
      >
        <IconPlus />
      </button>
    </div>
  );
}

// ---------- Choix entre deux options ----------

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-line bg-black/30 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`min-h-12 rounded-xl px-3 text-base font-semibold select-none ${
            option.value === value ? 'bg-accent text-accent-ink' : 'text-muted active:bg-raised'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Interrupteur ----------

export function Switch({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center gap-3 text-left select-none"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {detail && <span className="block text-sm text-muted">{detail}</span>}
      </span>
      <span
        className={`flex h-8 w-14 shrink-0 items-center rounded-full border p-0.5 transition ${
          checked ? 'justify-end border-accent bg-accent' : 'justify-start border-line bg-raised'
        }`}
      >
        <span className={`size-6 rounded-full ${checked ? 'bg-accent-ink' : 'bg-muted'}`} />
      </span>
    </button>
  );
}

// ---------- Bouton rond d'en-tête ----------

export function HeaderButton({
  label,
  onClick,
  primary = false,
  children,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex size-12 shrink-0 items-center justify-center rounded-full select-none ${
        primary ? 'bg-accent text-accent-ink active:brightness-90' : 'bg-raised text-ink active:bg-line'
      }`}
    >
      {children ?? <IconMore />}
    </button>
  );
}

// ---------- Interrupteur seul (dans une ligne qui a déjà son nom) ----------

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-8 w-14 shrink-0 items-center rounded-full border p-0.5 transition select-none ${
        checked ? 'justify-end border-accent bg-accent' : 'justify-start border-line bg-raised'
      }`}
    >
      <span className={`size-6 rounded-full ${checked ? 'bg-accent-ink' : 'bg-muted'}`} />
    </button>
  );
}

// ---------- Réglages en continu (curseur, couleur) ----------

/**
 * Appelle `fn` au plus une fois tous les `ms` millisecondes, et toujours avec la dernière valeur :
 * glisser un curseur n'enregistre pas des dizaines de fois par seconde.
 */
export function useThrottledCallback<T>(fn: (value: T) => void, ms: number): (value: T) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const last = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<{ value: T } | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (pending.current) fnRef.current(pending.current.value);
    },
    [],
  );

  return useCallback(
    (value: T) => {
      const wait = ms - (Date.now() - last.current);
      if (wait <= 0) {
        last.current = Date.now();
        pending.current = null;
        fnRef.current(value);
        return;
      }
      pending.current = { value };
      if (timer.current === undefined) {
        timer.current = window.setTimeout(() => {
          timer.current = undefined;
          last.current = Date.now();
          const next = pending.current;
          pending.current = null;
          if (next) fnRef.current(next.value);
        }, wait);
      }
    },
    [ms],
  );
}

/** Curseur : la valeur suit le doigt, l'appli suit en direct. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const commit = useThrottledCallback(onChange, 120);
  // Une fois le doigt levé, on revient à la valeur enregistrée (elle peut aussi changer ailleurs).
  useEffect(() => {
    if (draft === null) return;
    const timer = window.setTimeout(() => setDraft(null), 600);
    return () => window.clearTimeout(timer);
  }, [draft, value]);
  const shown = draft ?? value;

  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className="font-semibold tabular-nums">{format(shown)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(event) => {
          const next = Number(event.target.value);
          setDraft(next);
          commit(next);
        }}
        className="mt-1 h-9 w-full"
      />
    </label>
  );
}

const RAINBOW = 'conic-gradient(#ff3b30, #ffcc00, #34c759, #00c7be, #007aff, #af52de, #ff2d55, #ff3b30)';

/** Pastilles de couleur, plus une pastille arc-en-ciel pour choisir n'importe quelle couleur. */
export function ColorChoice({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string;
  value: string;
  swatches: string[];
  onChange: (color: string) => void;
}) {
  const commit = useThrottledCallback(onChange, 150);
  const custom = !swatches.includes(value);
  const ring = 'ring-2 ring-ink ring-offset-2 ring-offset-bg';
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-3">
      {swatches.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Couleur ${color}`}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className={`size-10 rounded-full border border-white/20 ${value === color ? ring : ''}`}
          style={{ background: color }}
        />
      ))}
      <label
        className={`relative size-10 overflow-hidden rounded-full border border-white/20 ${custom ? ring : ''}`}
        style={{ background: custom ? value : RAINBOW }}
      >
        <span className="sr-only">Autre couleur</span>
        <input
          type="color"
          value={value}
          onChange={(event) => commit(event.target.value.toLowerCase())}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
