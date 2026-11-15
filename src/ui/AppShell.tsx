import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useBackupDue } from '../data';
import { IconHistory, IconProgram, IconSettings, IconStats, IconToday } from './icons';

const TABS = [
  { to: '/', label: 'Aujourd’hui', icon: IconToday },
  { to: '/programme', label: 'Programme', icon: IconProgram },
  { to: '/historique', label: 'Historique', icon: IconHistory },
  { to: '/stats', label: 'Stats', icon: IconStats },
  { to: '/reglages', label: 'Réglages', icon: IconSettings },
];

/** Cadre commun à toutes les pages : contenu défilant, bandeau de mise à jour, barre du bas. */
export function AppShell() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);

  // Chaque page s'ouvre en haut.
  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col">
      <main ref={main} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>
      <UpdateBanner />
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const backupDue = useBackupDue();
  return (
    <nav
      aria-label="Navigation principale"
      className="grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ to, label, icon: TabIcon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold select-none ${
              isActive ? 'text-accent' : 'text-muted active:text-ink'
            }`
          }
        >
          <TabIcon />
          <span>{label}</span>
          {to === '/reglages' && backupDue && (
            <span
              className="absolute right-[calc(50%-1.1rem)] top-2.5 size-2.5 rounded-full bg-gold"
              aria-label="Sauvegarde conseillée"
            />
          )}
        </NavLink>
      ))}
    </nav>
  );
}

const UPDATE_CHECK_MS = 30 * 60 * 1000;

/**
 * Bandeau « Mise à jour disponible ».
 * La nouvelle version ne remplace que les fichiers de l'appli :
 * les données (IndexedDB) ne sont pas concernées.
 */
function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Une appli installée reste ouverte longtemps : on revérifie régulièrement,
      // et à chaque retour au premier plan.
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
  const [updating, setUpdating] = useState(false);

  if (!needRefresh) return null;

  const update = () => {
    setUpdating(true);
    void updateServiceWorker(true);
    // Filet de sécurité si le rechargement automatique ne se déclenche pas.
    setTimeout(() => window.location.reload(), 4000);
  };

  return (
    <div role="status" className="flex items-center gap-3 bg-accent px-4 py-2 text-accent-ink">
      <p className="flex-1 text-base font-bold">Mise à jour disponible</p>
      <button
        type="button"
        onClick={update}
        disabled={updating}
        className="min-h-11 rounded-xl bg-accent-ink px-4 text-base font-semibold text-accent disabled:opacity-60"
      >
        {updating ? 'Installation…' : 'Mettre à jour'}
      </button>
    </div>
  );
}
