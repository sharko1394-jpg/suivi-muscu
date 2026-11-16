import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './components';
import { messageOf } from './format';
import { IconClose } from './icons';

// ---------- Panneau qui monte du bas de l'écran ----------

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-xl flex-col glass rounded-t-3xl border-b-0"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line/60 py-2 pl-5 pr-3">
          <h2 className="min-w-0 flex-1 text-xl font-bold leading-snug">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-raised active:bg-line"
          >
            <IconClose />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------- Menu d'actions ----------

export interface SheetAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

export function ActionSheet({
  open,
  title,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="glass grid w-full max-w-md gap-2 rounded-3xl p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="truncate px-1 pb-1 text-sm font-semibold uppercase tracking-wider text-muted">
          {title}
        </h2>
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.danger ? 'danger' : 'secondary'}
            onClick={() => {
              onClose();
              action.onSelect();
            }}
          >
            {action.label}
          </Button>
        ))}
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

// ---------- Saisie d'un nom ----------

interface PromptProps {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  /** Peut échouer avec un message à afficher (nom vide, trop long…). */
  onConfirm: (value: string) => Promise<void> | void;
  onCancel: () => void;
}

/** Placée en haut de l'écran pour rester visible au-dessus du clavier. */
export function PromptDialog({ open, ...props }: PromptProps & { open: boolean }) {
  return open ? <PromptForm {...props} /> : null;
}

function PromptForm({
  title,
  label,
  initialValue = '',
  placeholder,
  confirmLabel,
  onConfirm,
  onCancel,
}: PromptProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onConfirm(value);
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-3 pt-[calc(env(safe-area-inset-top)+3.5rem)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-title"
      onClick={busy ? undefined : onCancel}
    >
      <form
        onSubmit={submit}
        noValidate
        className="glass w-full max-w-md space-y-4 rounded-3xl p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="prompt-title" className="text-xl font-bold">
          {title}
        </h2>
        <input
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          aria-label={label}
          placeholder={placeholder}
          maxLength={60}
          autoFocus
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          className="h-14 w-full rounded-2xl border border-line bg-raised px-4 text-ink outline-none placeholder:text-muted focus:border-accent"
        />
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
