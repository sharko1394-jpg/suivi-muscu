import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { IconAlert, IconCheck } from './icons';

type Kind = 'success' | 'error';
type ShowToast = (message: string, kind?: Kind) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** Affiche un court message en bas de l'écran. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; kind: Kind } | null>(null);

  const show = useCallback<ShowToast>((message, kind = 'success') => {
    setToast({ id: Date.now(), message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    // Une erreur reste plus longtemps à l'écran : il faut avoir le temps de la lire.
    const timer = setTimeout(() => setToast(null), toast.kind === 'error' ? 8000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex justify-center px-4">
          <div
            role={toast.kind === 'error' ? 'alert' : 'status'}
            onClick={() => setToast(null)}
            className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-base font-medium shadow-xl shadow-black/60 ${
              toast.kind === 'error'
                ? 'glass border-danger/60 text-ink'
                : 'glass text-ink'
            }`}
          >
            {toast.kind === 'error' ? (
              <IconAlert className="mt-0.5 shrink-0 text-danger" />
            ) : (
              <IconCheck className="mt-0.5 shrink-0 text-accent" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
