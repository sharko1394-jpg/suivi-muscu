import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useBackupDue, useSettings, visibleTabs, type TabsLayout } from '../data';
import { TAB_DEFS, tabLabel } from './tabs';

/**
 * Cadre commun à toutes les pages.
 * Le contenu défile sous une barre d'onglets flottante en verre, qui le laisse deviner.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  // Onglets personnalisés (ordre, noms, style). Pas de barre tant qu'ils ne sont pas lus : pas d'éclair.
  const tabs = useSettings()?.appearance.tabs ?? null;
  const docked = tabs?.style === 'docked';

  // Chaque page s'ouvre en haut.
  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="relative mx-auto h-dvh max-w-xl">
      <main
        ref={main}
        className={`h-full overflow-y-auto overscroll-contain ${
          tabs?.labelMode === 'always'
            ? 'pb-[calc(env(safe-area-inset-bottom)+6.5rem)]'
            : 'pb-[calc(env(safe-area-inset-bottom)+5.5rem)]'
        }`}
      >
        <Outlet />
      </main>
      <div
        className={`pointer-events-none absolute z-20 space-y-2 ${
          docked ? 'inset-x-0 bottom-0' : 'inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]'
        }`}
      >
        <div className={docked ? 'px-3' : undefined}>
          <UpdateBanner />
        </div>
        {tabs && <BottomNav tabs={tabs} />}
      </div>
    </div>
  );
}

/** Largeur du fondu sur les bords de la barre quand il reste des onglets à faire glisser. */
const EDGE_FADE = '1.75rem';

function BottomNav({ tabs }: { tabs: TabsLayout }) {
  const backupDue = useBackupDue();
  const { pathname } = useLocation();
  const ids = visibleTabs(tabs);
  const docked = tabs.style === 'docked';
  const always = tabs.labelMode === 'always';
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const placed = useRef(false);

  // La barre défile de gauche à droite quand les onglets ne tiennent pas tous : les bords s'estompent
  // du côté où il en reste à découvrir.
  const updateEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((current) => (current.left === left && current.right === right ? current : { left, right }));
  }, []);

  // L'onglet ouvert vient se placer au milieu de la barre (sans animation à l'ouverture de l'appli).
  const order = ids.join();
  useEffect(() => {
    const el = scroller.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && active) {
      const left = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
      el.scrollTo({ left: Math.max(0, left), behavior: placed.current ? 'smooth' : 'auto' });
      placed.current = true;
    }
    updateEdges();
  }, [pathname, order, tabs.labelMode, updateEdges]);

  useEffect(() => {
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges]);

  const mask =
    edges.left || edges.right
      ? `linear-gradient(to right, ${edges.left ? 'transparent' : 'black'} 0, black ${EDGE_FADE}, black calc(100% - ${EDGE_FADE}), ${edges.right ? 'transparent' : 'black'} 100%)`
      : undefined;

  return (
    <nav
      aria-label="Navigation principale"
      className={`glass pointer-events-auto ${
        docked
          ? 'w-full rounded-none border-x-0 border-b-0 px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.375rem)]'
          : `mx-auto max-w-full rounded-full p-1.5 ${always ? 'w-full' : 'w-fit'}`
      }`}
    >
      <div
        ref={scroller}
        onScroll={updateEdges}
        className={`no-scrollbar relative flex items-center overflow-x-auto overscroll-x-contain ${always ? 'gap-0' : 'gap-0.5'}`}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {/* L'onglet ouvert devient une pilule de la couleur principale. */}
        {ids.map((id) => {
          const { path, icon: TabIcon } = TAB_DEFS[id];
          const label = tabLabel(tabs, id);
          return (
            <NavLink
              key={id}
              to={path}
              end={id === 'today'}
              aria-label={label}
              className={({ isActive }) =>
                always
                  ? `relative flex h-14 min-w-[4.6rem] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 px-1 font-semibold select-none transition-[background-color] ${
                      docked ? 'rounded-2xl' : 'rounded-full'
                    } ${isActive ? 'bg-accent text-accent-ink' : 'text-muted active:text-ink'}`
                  : `relative flex h-13 shrink-0 items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap select-none transition-[background-color] ${
                      isActive ? 'min-w-16 bg-accent px-4 text-accent-ink' : 'w-13 text-muted active:text-ink'
                    }`
              }
            >
              {({ isActive }) => (
                <>
                  <TabIcon className={always ? 'size-5 shrink-0' : 'shrink-0'} />
                  {always ? (
                    <span className="max-w-full truncate text-[0.62rem] font-medium leading-tight tracking-tight">{label}</span>
                  ) : (
                    isActive && tabs.labelMode === 'active' && <span>{label}</span>
                  )}
                  {id === 'settings' && backupDue && (
                    <span
                      className={`absolute size-2.5 rounded-full bg-gold ${always ? 'right-3 top-1.5' : 'right-2 top-2'}`}
                      aria-label="Sauvegarde conseillée"
                    />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
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
