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

/**
 * Cadre commun à toutes les pages.
 * Le contenu défile sous une barre d'onglets flottante en verre, qui le laisse deviner.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);

  // Chaque page s'ouvre en haut.
  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="relative mx-auto h-dvh max-w-xl">
      <main
        ref={main}
        className="h-full overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+5.5rem)]"
      >
        <Outlet />
      </main>
      <div className="pointer-events-none absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-20 space-y-2">
        <UpdateBanner />
        <BottomNav />
      </div>
    </div>
  );
}

function BottomNav() {
  const backupDue = useBackupDue();
  return (
    <nav
      aria-label="Navigation principale"
      className="glass pointer-events-auto grid grid-cols-5 rounded-[2rem] p-1.5"
    >
      {TABS.map(({ to, label, icon: TabIcon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.6rem] text-[0.68rem] font-semibold select-none ${
              isActive ? 'bg-white/12 text-accent' : 'text-muted active:text-ink'
            }`
          }
        >
          <TabIcon />
          <span>{label}</span>
          {to === '/reglages' && backupDue && (
            <span
              className="absolute right-[calc(50%-1.1rem)] top-2 size-2.5 rounded-full bg-gold"
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
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-3 rounded-[1.6rem] bg-accent py-2 pl-5 pr-2 text-accent-ink shadow-xl shadow-black/50"
    >
      <p className="flex-1 text-base font-bold">Mise à jour disponible</p>
      <button
        type="button"
        onClick={update}
        disabled={updating}
        className="min-h-11 rounded-full bg-black/85 px-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {updating ? 'Installation…' : 'Mettre à jour'}
      </button>
    </div>
  );
}
