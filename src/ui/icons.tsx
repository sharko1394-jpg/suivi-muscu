import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconToday = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />
  </Icon>
);

export const IconProgram = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </Icon>
);

export const IconHistory = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
    <path d="M16 2.5v4M8 2.5v4M3 10h18" />
  </Icon>
);

export const IconStats = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3v18h18" />
    <path d="m7 15 4-4 3 3 5-6" />
  </Icon>
);

/** Ampoule : l'onglet Conseils. */
export const IconCoach = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
  </Icon>
);

/** Flèche vers le haut, vers le bas, ou à plat (conseils de charge). */
export const IconTrendUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
);

export const IconTrendDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
);

export const IconTrendFlat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0" />
    <circle cx="15" cy="6" r="2.5" />
    <circle cx="9" cy="12" r="2.5" />
    <circle cx="17" cy="18" r="2.5" />
  </Icon>
);

export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 5-7 7 7 7" />
  </Icon>
);

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconMinus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

/** Trois points : ouvre un menu d'actions. */
export const IconMore = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3" />
  </Icon>
);

/** Poignée de déplacement (glisser-déposer). */
export const IconGrip = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 8h14M5 12h14M5 16h14" />
  </Icon>
);

/** Maillon : deux exercices liés en superset. */
export const IconLink = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Icon>
);

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 2.5 20h19z" />
    <path d="M12 10v4.5M12 17.5h.01" />
  </Icon>
);

/** Trois blocs : les widgets de l'accueil. */
export const IconWidgets = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="17" height="7" rx="2" />
  </Icon>
);

/** Cadenas : élément qu'on ne peut pas retirer. */
export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="9.5" rx="2" />
    <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
  </Icon>
);

/** Photo : fond personnel. */
export const IconImage = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="9" cy="9.5" r="1.8" />
    <path d="m21 16-5-5-9 9" />
  </Icon>
);

/** Crayon : renommer. */
export const IconPencil = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
);

/** Palette : personnaliser l'apparence. */
export const IconPalette = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 2-2 0-.6-.3-1-.6-1.4-.3-.4-.6-.8-.6-1.4 0-1.1.9-2 2-2h2.2A4 4 0 0 0 21 10.2C21 6.2 17 3 12 3z" />
    <circle cx="7.5" cy="11" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="10" cy="7" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7.2" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

/** Flamme : la série de séances d'affilée. */
export const IconFlame = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3c.5 3-1.8 4.6-3.2 6.3C7.4 11 6.5 12.7 6.5 14.8A5.5 5.5 0 0 0 12 20.5a5.5 5.5 0 0 0 5.5-5.7c0-2.3-1-4-2.2-5.4-.3 1.3-1 2.2-2 2.6.6-2.9-.1-6.1-1.3-9z" />
  </Icon>
);

/** Cible : les objectifs personnels. */
export const IconTarget = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </Icon>
);

/** Livre ouvert : la bibliothèque d'exercices. */
export const IconLibrary = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 6.5C10.2 5 7.6 4.5 4 4.5v13c3.6 0 6.2.5 8 2 1.8-1.5 4.4-2 8-2v-13c-3.6 0-6.2.5-8 2z" />
    <path d="M12 6.5v13" />
  </Icon>
);

/** Coupe : record ou objectif atteint. */
export const IconTrophy = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4" />
    <path d="M12 13v4M8.5 20.5h7M10 17h4l.5 3.5h-5z" />
  </Icon>
);

/** Étoile : bilan du mois et de l'année. */
export const IconSparkle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5l2.1 5.4 5.4 2.1-5.4 2.1-2.1 5.4-2.1-5.4L4.5 11l5.4-2.1z" />
    <path d="M19 16.5v4M17 18.5h4" />
  </Icon>
);

/** Pomme : la nutrition. */
export const IconNutrition = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 7.5c-1.6-1.4-4.3-1.6-6 .2-2 2.1-1.5 6.4.6 9.6 1.3 2 2.9 3.4 4.4 2.6.6-.3.8-.4 1-.4s.4.1 1 .4c1.5.8 3.1-.6 4.4-2.6 2.1-3.2 2.6-7.5.6-9.6-1.7-1.8-4.4-1.6-6-.2z" />
    <path d="M12 7.5C12 5 13.2 3.5 15 3" />
  </Icon>
);

/** Silhouette : le profil. */
export const IconProfile = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" />
  </Icon>
);

export const IconShare = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 15V3.5M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </Icon>
);
