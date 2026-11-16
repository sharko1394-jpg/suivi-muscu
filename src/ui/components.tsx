import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { IconChevronLeft, IconChevronRight } from './icons';

// ---------- Bouton ----------

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink active:brightness-90',
  secondary: 'border border-line bg-raised text-ink active:bg-line',
  danger: 'border border-danger/50 bg-danger/10 text-danger active:bg-danger/20',
  ghost: 'text-ink active:bg-raised',
};

export const buttonClass = (variant: Variant = 'secondary') =>
  `flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-center text-lg font-semibold transition select-none disabled:opacity-40 ${VARIANTS[variant]}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return <button type="button" {...props} className={`${buttonClass(variant)} ${className}`} />;
}

// ---------- Mise en page ----------

export function PageHeader({
  title,
  subtitle,
  backTo,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  /** Page vers laquelle la flèche de retour ramène. */
  backTo?: string;
  /** À la place de backTo : action à faire au retour (ex. revenir à la page précédente). */
  onBack?: () => void;
  action?: ReactNode;
}) {
  const backClass =
    '-ml-3 flex size-12 shrink-0 items-center justify-center rounded-full active:bg-raised';
  return (
    <header className="sticky top-0 z-10 flex items-center gap-1 bg-bg/30 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Retour" className={backClass}>
          <IconChevronLeft />
        </button>
      ) : (
        backTo && (
          <Link to={backTo} aria-label="Retour" className={backClass}>
            <IconChevronLeft />
          </Link>
        )
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold">{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted first-letter:uppercase">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-line bg-surface p-4 ${className}`}>{children}</div>
  );
}

/** Ligne cliquable menant à une autre page. */
export function LinkRow({ to, title, detail }: { to: string; title: string; detail?: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-16 items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3 active:bg-raised"
    >
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">{title}</p>
        {detail && <p className="text-sm text-muted">{detail}</p>}
      </div>
      <IconChevronRight className="shrink-0 text-muted" />
    </Link>
  );
}

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full border px-4 text-base font-medium select-none ${
        selected
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-line bg-raised text-ink active:bg-line'
      }`}
    >
      {children}
    </button>
  );
}


// ---------- Fenêtre de confirmation ----------

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Annuler',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="glass w-full max-w-md rounded-3xl p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="dialog-title" className="text-xl font-bold">
          {title}
        </h2>
        {children && <div className="mt-2 space-y-2 text-muted">{children}</div>}
        <div className="mt-5 grid gap-2">
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
