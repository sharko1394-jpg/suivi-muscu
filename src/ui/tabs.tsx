import type { SVGProps } from 'react';
import type { TabId, TabsLayout } from '../data';
import {
  IconCoach,
  IconHistory,
  IconLibrary,
  IconNutrition,
  IconProgram,
  IconSettings,
  IconStats,
  IconToday,
} from './icons';

/** Les onglets : adresse, nom d'origine et icône. L'ordre, les noms et l'affichage se personnalisent. */
export const TAB_DEFS: Record<TabId, { path: string; label: string; icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element }> = {
  today: { path: '/', label: 'Aujourd’hui', icon: IconToday },
  program: { path: '/programme', label: 'Programme', icon: IconProgram },
  history: { path: '/historique', label: 'Historique', icon: IconHistory },
  stats: { path: '/stats', label: 'Stats', icon: IconStats },
  coach: { path: '/conseils', label: 'Conseils', icon: IconCoach },
  nutrition: { path: '/nutrition', label: 'Nutrition', icon: IconNutrition },
  library: { path: '/bibliotheque', label: 'Bibliothèque', icon: IconLibrary },
  settings: { path: '/reglages', label: 'Réglages', icon: IconSettings },
};

/** Nom affiché d'un onglet : celui choisi par l'utilisateur, sinon le nom d'origine. */
export const tabLabel = (tabs: TabsLayout, id: TabId) => tabs.labels[id] ?? TAB_DEFS[id].label;
