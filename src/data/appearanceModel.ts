// Personnalisation de l'appli (V2) : apparence, onglets et accueil.
//
// Ce fichier ne contient que des définitions pures (aucun accès à la base). Il sert aux réglages,
// aux fichiers de thème partagés et à l'affichage.
//
// Tout est rangé dans le réglage `appearance` (tiroir `settings`), et les photos de fond dans des
// lignes `fond:…` du même tiroir : la forme de la base ne change pas (toujours la version 1), donc
// la V1 peut toujours rouvrir les données.
//
// Le thème « Défaut » reproduit exactement la V1 : ne pas modifier ses valeurs.

// ---------- Onglets ----------

export type TabId = 'today' | 'program' | 'history' | 'stats' | 'coach' | 'library' | 'settings';

/** Ordre d'origine. Un onglet ajouté dans une nouvelle version prend sa place dans l'ordre déjà choisi. */
export const TAB_IDS: TabId[] = ['today', 'program', 'history', 'stats', 'coach', 'library', 'settings'];

/** Onglets impossibles à masquer : on y démarre les séances, et on y retrouve la personnalisation. */
export const LOCKED_TABS: TabId[] = ['today', 'settings'];

export const TAB_LABEL_MAX = 14;

/** Noms des onglets : sous l'onglet ouvert seulement, sous tous, ou jamais. */
export type TabLabelMode = 'active' | 'always' | 'never';
/** Barre flottante (pilule en verre) ou collée en bas de l'écran. */
export type TabBarStyle = 'floating' | 'docked';

export interface TabsLayout {
  order: TabId[];
  hidden: TabId[];
  /** Noms choisis par l'utilisateur ; absent = nom d'origine. */
  labels: Partial<Record<TabId, string>>;
  labelMode: TabLabelMode;
  style: TabBarStyle;
  /** Onglet affiché à l'ouverture de l'appli. */
  start: TabId;
}

// ---------- Widgets de l'accueil ----------

export type WidgetId =
  | 'plan'
  | 'doneToday'
  | 'week'
  | 'lastSession'
  | 'ready'
  | 'records'
  | 'forecast'
  | 'bodyweight'
  | 'volume'
  | 'streak'
  | 'goals';

/** Petit = une demi-largeur ; grand = toute la largeur. */
export type WidgetSize = 'small' | 'large';

export interface WidgetSlot {
  id: WidgetId;
  size: WidgetSize;
}

export interface WidgetDef {
  id: WidgetId;
  label: string;
  /** Tailles possibles, la première est celle proposée à l'ajout. */
  sizes: WidgetSize[];
  /** Toujours présent (on peut seulement le déplacer). */
  locked?: boolean;
}

export const WIDGETS: WidgetDef[] = [
  // C'est là qu'on démarre ou reprend une séance : il ne peut pas disparaître.
  { id: 'plan', label: 'Séance du jour', sizes: ['large'], locked: true },
  { id: 'streak', label: 'Séances d’affilée', sizes: ['small', 'large'] },
  { id: 'goals', label: 'Mes objectifs', sizes: ['small', 'large'] },
  { id: 'doneToday', label: 'Fait aujourd’hui', sizes: ['large'] },
  { id: 'week', label: 'Cette semaine', sizes: ['small', 'large'] },
  { id: 'lastSession', label: 'Dernière séance', sizes: ['small', 'large'] },
  { id: 'ready', label: 'Prêts à monter', sizes: ['small', 'large'] },
  { id: 'records', label: 'Records récents', sizes: ['small', 'large'] },
  { id: 'forecast', label: 'Prochain record', sizes: ['small', 'large'] },
  { id: 'bodyweight', label: 'Poids de corps', sizes: ['small', 'large'] },
  { id: 'volume', label: 'Séries de la semaine', sizes: ['large'] },
];

export const widgetDef = (id: WidgetId): WidgetDef => WIDGETS.find((w) => w.id === id)!;

// ---------- Fonds ----------

/** Fond animé (dessiné en continu), couleur unie, dégradé, ou photo de l'utilisateur. */
export type BackgroundKind = 'animated' | 'solid' | 'gradient' | 'image';

export type AnimatedPresetId = 'forge' | 'ocean' | 'aurora' | 'emerald' | 'sunset' | 'graphite' | 'gold';

/** Couleur pour le dessin du fond : rouge, vert, bleu entre 0 et 1. */
export type Rgb = [number, number, number];

export interface AnimatedPreset {
  id: AnimatedPresetId;
  label: string;
  /** Cinq teintes portées par le liquide (les deux dernières restent des éclats). */
  palette: [Rgb, Rgb, Rgb, Rgb, Rgb];
  /** Voiles lumineux qui ondulent dans le haut. */
  curtain: [Rgb, Rgb];
  /** Reflets sur le liquide. */
  glint: Rgb;
  /** Ondes sous le doigt. */
  ripple: Rgb;
  /** Vague de fin de repos. */
  wave: Rgb;
  /** Bords assombris. */
  shade: Rgb;
  /** Teinte des cartes et des panneaux en verre (0–255). */
  surface: [number, number, number];
  glass: [number, number, number];
  /** Couleur de la page sous le fond. */
  base: string;
  /** Couleur principale assortie, pour le thème du même nom. */
  accent: string;
}

export const ANIMATED_PRESETS: Record<AnimatedPresetId, AnimatedPreset> = {
  // Forge liquide : la V1, à l'identique.
  forge: {
    id: 'forge',
    label: 'Forge',
    palette: [
      [0.3, 0.02, 0.08],
      [0.8, 0.06, 0.12],
      [0.52, 0.01, 0.03],
      [0.98, 0.34, 0.08],
      [0.78, 0.1, 0.38],
    ],
    curtain: [
      [0.95, 0.15, 0.1],
      [1.0, 0.45, 0.15],
    ],
    glint: [1.0, 0.62, 0.45],
    ripple: [1.0, 0.4, 0.3],
    wave: [1.0, 0.18, 0.12],
    shade: [0.05, 0.03, 0.035],
    surface: [26, 18, 20],
    glass: [44, 30, 32],
    base: '#121213',
    accent: '#b5121b',
  },
  ocean: {
    id: 'ocean',
    label: 'Océan',
    palette: [
      [0.02, 0.08, 0.22],
      [0.05, 0.3, 0.72],
      [0.01, 0.13, 0.33],
      [0.1, 0.76, 0.9],
      [0.06, 0.55, 0.58],
    ],
    curtain: [
      [0.1, 0.45, 0.95],
      [0.3, 0.85, 1.0],
    ],
    glint: [0.7, 0.92, 1.0],
    ripple: [0.4, 0.8, 1.0],
    wave: [0.2, 0.6, 1.0],
    shade: [0.02, 0.03, 0.06],
    surface: [15, 22, 33],
    glass: [27, 38, 56],
    base: '#0d1117',
    accent: '#1a73e8',
  },
  aurora: {
    id: 'aurora',
    label: 'Aurore',
    palette: [
      [0.18, 0.05, 0.36],
      [0.46, 0.16, 0.86],
      [0.1, 0.05, 0.3],
      [0.15, 0.85, 0.85],
      [0.95, 0.3, 0.7],
    ],
    curtain: [
      [0.3, 0.95, 0.7],
      [0.55, 0.4, 1.0],
    ],
    glint: [0.85, 0.75, 1.0],
    ripple: [0.7, 0.6, 1.0],
    wave: [0.6, 0.4, 1.0],
    shade: [0.03, 0.02, 0.06],
    surface: [22, 18, 33],
    glass: [38, 30, 56],
    base: '#100d17',
    accent: '#7c3aed',
  },
  emerald: {
    id: 'emerald',
    label: 'Émeraude',
    palette: [
      [0.02, 0.18, 0.1],
      [0.05, 0.55, 0.3],
      [0.01, 0.28, 0.16],
      [0.55, 0.9, 0.3],
      [0.1, 0.7, 0.6],
    ],
    curtain: [
      [0.2, 0.9, 0.5],
      [0.7, 1.0, 0.4],
    ],
    glint: [0.8, 1.0, 0.75],
    ripple: [0.5, 1.0, 0.7],
    wave: [0.2, 0.9, 0.5],
    shade: [0.02, 0.05, 0.03],
    surface: [15, 26, 20],
    glass: [27, 44, 34],
    base: '#0c130f',
    accent: '#16a34a',
  },
  sunset: {
    id: 'sunset',
    label: 'Crépuscule',
    palette: [
      [0.25, 0.04, 0.25],
      [0.75, 0.12, 0.45],
      [0.55, 0.12, 0.05],
      [1.0, 0.6, 0.12],
      [0.95, 0.45, 0.35],
    ],
    curtain: [
      [1.0, 0.35, 0.3],
      [1.0, 0.7, 0.3],
    ],
    glint: [1.0, 0.8, 0.55],
    ripple: [1.0, 0.6, 0.4],
    wave: [1.0, 0.4, 0.2],
    shade: [0.05, 0.02, 0.04],
    surface: [30, 18, 24],
    glass: [50, 30, 40],
    base: '#140c10',
    accent: '#e2541b',
  },
  graphite: {
    id: 'graphite',
    label: 'Graphite',
    palette: [
      [0.08, 0.08, 0.09],
      [0.32, 0.33, 0.36],
      [0.14, 0.14, 0.16],
      [0.8, 0.82, 0.86],
      [0.48, 0.5, 0.55],
    ],
    curtain: [
      [0.6, 0.62, 0.68],
      [0.85, 0.87, 0.92],
    ],
    glint: [1.0, 1.0, 1.0],
    ripple: [0.8, 0.8, 0.85],
    wave: [0.9, 0.9, 0.95],
    shade: [0.03, 0.03, 0.035],
    surface: [22, 22, 25],
    glass: [40, 40, 45],
    base: '#111113',
    accent: '#e4e4e7',
  },
  gold: {
    id: 'gold',
    label: 'Or',
    palette: [
      [0.25, 0.14, 0.03],
      [0.85, 0.6, 0.12],
      [0.45, 0.25, 0.04],
      [1.0, 0.85, 0.35],
      [0.75, 0.38, 0.15],
    ],
    curtain: [
      [1.0, 0.7, 0.2],
      [1.0, 0.9, 0.5],
    ],
    glint: [1.0, 0.95, 0.75],
    ripple: [1.0, 0.85, 0.5],
    wave: [1.0, 0.7, 0.2],
    shade: [0.05, 0.04, 0.02],
    surface: [28, 24, 16],
    glass: [48, 40, 26],
    base: '#14110b',
    accent: '#d4a017',
  },
};

export const ANIMATED_PRESET_IDS = Object.keys(ANIMATED_PRESETS) as AnimatedPresetId[];

export interface BackgroundSettings {
  kind: BackgroundKind;
  /** Fond animé : ambiance choisie. */
  preset: AnimatedPresetId;
  /** Fond animé : vitesse, 1 = normale. */
  speed: number;
  /** Fond animé : luminosité, 1 = normale. */
  intensity: number;
  /** Couleur unie, ou début du dégradé. */
  color: string;
  /** Fin du dégradé. */
  color2: string;
  /** Photo choisie parmi « mes fonds ». */
  imageId: string | null;
  /** Flou de la photo, en pixels. */
  imageBlur: number;
  /** Assombrissement de la photo, de 0 à 1, pour garder le texte lisible. */
  imageDim: number;
}

export const BACKGROUND_LIMITS = {
  speed: { min: 0.25, max: 2 },
  intensity: { min: 0.5, max: 1.5 },
  imageBlur: { min: 0, max: 30 },
  imageDim: { min: 0, max: 0.85 },
} as const;

// ---------- Apparence ----------

/** Coins des cartes : nets, doux, ronds (la V1) ou très ronds. */
export type Corners = 'sharp' | 'soft' | 'round' | 'xl';
export type FontChoice = 'poppins' | 'system' | 'rounded' | 'serif' | 'mono';
export type TextSize = 'small' | 'normal' | 'large' | 'xlarge';
/** Animations : comme le téléphone, toujours, ou réduites (fond figé). */
export type MotionChoice = 'auto' | 'full' | 'reduced';

export const CORNERS: Corners[] = ['sharp', 'soft', 'round', 'xl'];
export const FONTS: FontChoice[] = ['poppins', 'system', 'rounded', 'serif', 'mono'];
export const TEXT_SIZES: TextSize[] = ['small', 'normal', 'large', 'xlarge'];
export const MOTIONS: MotionChoice[] = ['auto', 'full', 'reduced'];

export const LOOK_LIMITS = {
  cardOpacity: { min: 0.1, max: 0.9 },
  blur: { min: 0, max: 40 },
} as const;

/** Ce qu'un thème change : couleurs, fond, verre, coins et police. */
export interface Look {
  /** Couleur des boutons principaux et de l'onglet ouvert. */
  accent: string;
  background: BackgroundSettings;
  /** Opacité des cartes en verre. */
  cardOpacity: number;
  /** Flou derrière le verre, en pixels. */
  blur: number;
  corners: Corners;
  font: FontChoice;
}

export interface Effects {
  /** Onde dans le fond sous le doigt. */
  ripples: boolean;
  /** Onde de choc dorée à chaque record. */
  recordWave: boolean;
  /** Le fond ralentit et respire pendant le repos. */
  restBreath: boolean;
}

/** Toute la personnalisation. La taille du texte et les animations restent propres à chacun : un thème ne les change pas. */
export interface Appearance extends Look {
  textSize: TextSize;
  motion: MotionChoice;
  effects: Effects;
  tabs: TabsLayout;
  home: WidgetSlot[];
  /** Version de l'accueil enregistré : un widget de base ajouté depuis n'y entre qu'une seule fois. */
  homeVersion: number;
}

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  kind: 'animated',
  preset: 'forge',
  speed: 1,
  intensity: 1,
  color: '#1c1417',
  color2: '#5a0d16',
  imageId: null,
  imageBlur: 0,
  imageDim: 0.35,
};

/** L'apparence de la V1, à l'identique. */
export const DEFAULT_LOOK: Look = {
  accent: '#b5121b',
  background: DEFAULT_BACKGROUND,
  cardOpacity: 0.46,
  blur: 20,
  corners: 'round',
  font: 'poppins',
};

export const DEFAULT_TABS: TabsLayout = {
  order: [...TAB_IDS],
  hidden: [],
  labels: {},
  labelMode: 'active',
  style: 'floating',
  start: 'today',
};

/**
 * Accueil de base : la séance du jour, la série de séances d'affilée et les objectifs côte à côte,
 * puis ce qui a été fait aujourd'hui. (En V1 et V2.0 : la séance du jour et « Fait aujourd'hui ».)
 */
export const DEFAULT_HOME: WidgetSlot[] = [
  { id: 'plan', size: 'large' },
  { id: 'streak', size: 'small' },
  { id: 'goals', size: 'small' },
  { id: 'doneToday', size: 'large' },
];

/** Version actuelle de l'accueil de base. */
export const HOME_VERSION = 2;

/** Widgets de base apparus à chaque version : ajoutés une fois à un accueil déjà personnalisé. */
const NEW_HOME_WIDGETS: Record<number, WidgetSlot[]> = {
  2: [
    { id: 'streak', size: 'small' },
    { id: 'goals', size: 'small' },
  ],
};

export const DEFAULT_APPEARANCE: Appearance = {
  ...DEFAULT_LOOK,
  textSize: 'normal',
  motion: 'auto',
  effects: { ripples: true, recordWave: true, restBreath: true },
  tabs: DEFAULT_TABS,
  home: DEFAULT_HOME,
  homeVersion: HOME_VERSION,
};

/** Couleurs principales proposées d'un appui (on peut aussi choisir n'importe quelle couleur). */
export const ACCENT_SWATCHES = [
  '#b5121b',
  '#e2541b',
  '#d4a017',
  '#16a34a',
  '#0d9488',
  '#1a73e8',
  '#4f46e5',
  '#7c3aed',
  '#db2777',
  '#e4e4e7',
];

// ---------- Thèmes prêts à l'emploi ----------

export interface ThemePreset {
  id: string;
  label: string;
  look: Look;
}

function presetLook(preset: AnimatedPresetId, extra: Partial<Look> = {}): Look {
  return {
    ...DEFAULT_LOOK,
    accent: ANIMATED_PRESETS[preset].accent,
    background: { ...DEFAULT_BACKGROUND, preset },
    ...extra,
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'defaut', label: 'Défaut', look: DEFAULT_LOOK },
  { id: 'ocean', label: 'Océan', look: presetLook('ocean') },
  { id: 'aurore', label: 'Aurore', look: presetLook('aurora', { font: 'rounded' }) },
  { id: 'emeraude', label: 'Émeraude', look: presetLook('emerald') },
  { id: 'crepuscule', label: 'Crépuscule', look: presetLook('sunset') },
  { id: 'graphite', label: 'Graphite', look: presetLook('graphite', { font: 'system', corners: 'soft' }) },
  { id: 'or', label: 'Or', look: presetLook('gold', { corners: 'xl' }) },
];

// ---------- Thèmes de l'utilisateur et photos ----------

export interface SavedTheme {
  id: string;
  name: string;
  look: Look;
  createdAt: number;
}

export const SAVED_THEME_NAME_MAX = 30;
export const MAX_SAVED_THEMES = 20;

/** Photo de fond importée par l'utilisateur (image déjà réduite, sous forme de texte « data: »). */
export interface CustomBackground {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: number;
}

/** Préfixe des lignes du tiroir `settings` qui contiennent les photos de fond. */
export const BACKGROUND_KEY_PREFIX = 'fond:';
export const MAX_CUSTOM_BACKGROUNDS = 8;
/** Taille maximale d'une photo enregistrée (texte « data: »), environ 4 Mo. */
export const MAX_BACKGROUND_CHARS = 5_500_000;

// ---------- Vérification des valeurs (réglages abîmés, anciens fichiers, fichiers partagés) ----------

const HEX = /^#[0-9a-f]{6}$/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const hex = (value: unknown, fallback: string) =>
  typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback;

const clamp = (value: unknown, limits: { min: number; max: number }, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(limits.max, Math.max(limits.min, value))
    : fallback;

const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

/**
 * Image encodée dans le texte lui-même, et rien d'autre : un fichier partagé ne peut pas
 * glisser une adresse internet (l'appli n'envoie et ne charge rien d'ailleurs).
 */
export function isValidImageDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_BACKGROUND_CHARS &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

export function normalizeBackground(raw: unknown, base: BackgroundSettings = DEFAULT_BACKGROUND): BackgroundSettings {
  const r = isObject(raw) ? raw : {};
  const kind = oneOf<BackgroundKind>(r.kind, ['animated', 'solid', 'gradient', 'image'], base.kind);
  const imageId = typeof r.imageId === 'string' && r.imageId !== '' ? r.imageId : null;
  return {
    // Une photo sans référence n'a pas de sens : on revient au fond animé.
    kind: kind === 'image' && imageId === null ? 'animated' : kind,
    preset: oneOf(r.preset, ANIMATED_PRESET_IDS, base.preset),
    speed: clamp(r.speed, BACKGROUND_LIMITS.speed, base.speed),
    intensity: clamp(r.intensity, BACKGROUND_LIMITS.intensity, base.intensity),
    color: hex(r.color, base.color),
    color2: hex(r.color2, base.color2),
    imageId,
    imageBlur: clamp(r.imageBlur, BACKGROUND_LIMITS.imageBlur, base.imageBlur),
    imageDim: clamp(r.imageDim, BACKGROUND_LIMITS.imageDim, base.imageDim),
  };
}

export function normalizeLook(raw: unknown, base: Look = DEFAULT_LOOK): Look {
  const r = isObject(raw) ? raw : {};
  return {
    accent: hex(r.accent, base.accent),
    background: normalizeBackground(r.background, base.background),
    cardOpacity: clamp(r.cardOpacity, LOOK_LIMITS.cardOpacity, base.cardOpacity),
    blur: clamp(r.blur, LOOK_LIMITS.blur, base.blur),
    corners: oneOf(r.corners, CORNERS, base.corners),
    font: oneOf(r.font, FONTS, base.font),
  };
}

export function normalizeTabs(raw: unknown): TabsLayout {
  const r = isObject(raw) ? raw : {};
  const listed = Array.isArray(r.order) ? r.order.filter((id): id is TabId => TAB_IDS.includes(id as TabId)) : [];
  // Un onglet absent (apparu dans une version plus récente) se place juste après celui qui le précède
  // d'origine : la Bibliothèque arrive après Conseils, même si l'ordre a été changé.
  const order = [...new Set(listed)];
  TAB_IDS.forEach((id, index) => {
    if (order.includes(id)) return;
    const before = TAB_IDS.slice(0, index).reverse().find((other) => order.includes(other));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  });
  const hidden = Array.isArray(r.hidden)
    ? [...new Set(r.hidden.filter((id): id is TabId => TAB_IDS.includes(id as TabId) && !LOCKED_TABS.includes(id as TabId)))]
    : [];
  const labels: Partial<Record<TabId, string>> = {};
  if (isObject(r.labels)) {
    for (const id of TAB_IDS) {
      const value = r.labels[id];
      if (typeof value === 'string' && value.trim() !== '') labels[id] = value.trim().slice(0, TAB_LABEL_MAX);
    }
  }
  const start = oneOf(r.start, TAB_IDS, DEFAULT_TABS.start);
  return {
    order,
    hidden,
    labels,
    labelMode: oneOf(r.labelMode, ['active', 'always', 'never'] as const, DEFAULT_TABS.labelMode),
    style: oneOf(r.style, ['floating', 'docked'] as const, DEFAULT_TABS.style),
    // Un onglet masqué ne peut pas être l'écran d'ouverture.
    start: hidden.includes(start) ? DEFAULT_TABS.start : start,
  };
}

export function normalizeHome(raw: unknown): WidgetSlot[] {
  const slots: WidgetSlot[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isObject(item)) continue;
      const def = WIDGETS.find((w) => w.id === item.id);
      if (!def || slots.some((s) => s.id === def.id)) continue;
      slots.push({ id: def.id, size: oneOf(item.size, def.sizes, def.sizes[0]) });
    }
  } else {
    return DEFAULT_HOME.map((slot) => ({ ...slot }));
  }
  // La séance du jour est toujours là : sans elle, impossible de démarrer une séance.
  if (!slots.some((s) => s.id === 'plan')) slots.unshift({ id: 'plan', size: 'large' });
  return slots;
}

/** Ajoute à un accueil déjà enregistré les widgets de base apparus depuis sa version (une seule fois). */
function withNewHomeWidgets(home: WidgetSlot[], version: number): WidgetSlot[] {
  const slots = [...home];
  for (let v = version + 1; v <= HOME_VERSION; v++) {
    let at = slots.findIndex((s) => s.id === 'plan') + 1;
    for (const slot of NEW_HOME_WIDGETS[v] ?? []) {
      if (slots.some((s) => s.id === slot.id)) continue;
      slots.splice(at++, 0, { ...slot });
    }
  }
  return slots;
}

export function normalizeAppearance(raw: unknown): Appearance {
  const r = isObject(raw) ? raw : {};
  const effects = isObject(r.effects) ? r.effects : {};
  // Accueil enregistré avant la version 2 : pas de numéro de version.
  const homeVersion =
    typeof r.homeVersion === 'number' && Number.isInteger(r.homeVersion) ? Math.min(Math.max(1, r.homeVersion), HOME_VERSION) : 1;
  return {
    ...normalizeLook(r),
    textSize: oneOf(r.textSize, TEXT_SIZES, DEFAULT_APPEARANCE.textSize),
    motion: oneOf(r.motion, MOTIONS, DEFAULT_APPEARANCE.motion),
    effects: {
      ripples: bool(effects.ripples, true),
      recordWave: bool(effects.recordWave, true),
      restBreath: bool(effects.restBreath, true),
    },
    tabs: normalizeTabs(r.tabs),
    home: Array.isArray(r.home) ? withNewHomeWidgets(normalizeHome(r.home), homeVersion) : normalizeHome(r.home),
    homeVersion: HOME_VERSION,
  };
}

export function normalizeSavedThemes(raw: unknown): SavedTheme[] {
  if (!Array.isArray(raw)) return [];
  const themes: SavedTheme[] = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.name !== 'string') continue;
    if (themes.some((t) => t.id === item.id)) continue;
    themes.push({
      id: item.id,
      name: item.name.trim().slice(0, SAVED_THEME_NAME_MAX) || 'Mon thème',
      look: normalizeLook(item.look),
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
    });
  }
  return themes.slice(0, MAX_SAVED_THEMES);
}

/** Ne garde que ce qui fait un thème. */
export function lookOf(appearance: Look): Look {
  return normalizeLook(appearance);
}

/**
 * Empreinte de ce qui se voit : deux apparences de même empreinte sont identiques à l'écran.
 * Les réglages qui ne servent pas au fond choisi (couleur d'un fond animé…) sont ignorés.
 */
export function lookSignature(look: Look): string {
  const l = normalizeLook(look);
  const b = l.background;
  const background =
    b.kind === 'animated'
      ? [b.kind, b.preset, b.speed, b.intensity]
      : b.kind === 'solid'
        ? [b.kind, b.color]
        : b.kind === 'gradient'
          ? [b.kind, b.color, b.color2]
          : [b.kind, b.imageId, b.imageBlur, b.imageDim];
  return JSON.stringify([l.accent, l.cardOpacity, l.blur, l.corners, l.font, ...background]);
}

/** Thème prêt à l'emploi qui correspond exactement à l'apparence actuelle, s'il y en a un. */
export function matchingPreset(look: Look): ThemePreset | undefined {
  const signature = lookSignature(look);
  return THEME_PRESETS.find((preset) => lookSignature(preset.look) === signature);
}

/** Nom du thème affiché : un thème prêt à l'emploi, un des miens, ou « Personnalisé ». */
export function themeName(look: Look, savedThemes: SavedTheme[]): string {
  const signature = lookSignature(look);
  return (
    THEME_PRESETS.find((t) => lookSignature(t.look) === signature)?.label ??
    savedThemes.find((t) => lookSignature(t.look) === signature)?.name ??
    'Personnalisé'
  );
}

/** Onglets affichés, dans l'ordre choisi. */
export function visibleTabs(tabs: TabsLayout): TabId[] {
  return tabs.order.filter((id) => !tabs.hidden.includes(id));
}

// ---------- Fichier de thème partagé ----------

/** Signature des fichiers de personnalisation. Ne jamais la changer. */
export const THEME_FILE_APP = 'suivi-muscu-theme';
export const THEME_FILE_VERSION = 1;

export interface ThemeFile {
  app: typeof THEME_FILE_APP;
  version: number;
  exportedAt: string;
  name: string;
  appearance: Appearance;
  /** Photos utilisées par cette personnalisation. */
  backgrounds: CustomBackground[];
}

export function normalizeCustomBackground(raw: unknown): CustomBackground | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || raw.id === '' || !isValidImageDataUrl(raw.dataUrl)) {
    return null;
  }
  return {
    id: raw.id,
    name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim().slice(0, 40) : 'Photo',
    dataUrl: raw.dataUrl,
    width: typeof raw.width === 'number' && raw.width > 0 ? Math.round(raw.width) : 0,
    height: typeof raw.height === 'number' && raw.height > 0 ? Math.round(raw.height) : 0,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
  };
}
