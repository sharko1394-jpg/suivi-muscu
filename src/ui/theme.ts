import {
  ANIMATED_PRESETS,
  DEFAULT_LOOK,
  type AnimatedPreset,
  type Appearance,
  type BackgroundSettings,
  type Corners,
  type FontChoice,
  type Rgb,
  type TextSize,
} from '../data';

// Traduit la personnalisation en variables CSS posées sur <html> : toute l'appli suit d'un coup,
// sans recharger la page. Avec le thème « Défaut », les valeurs sont exactement celles de la V1.

type Rgb255 = [number, number, number];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function hexToRgb(hex: string): Rgb255 {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb255): string {
  return `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
}

const mix = (a: Rgb255, b: Rgb255, t: number): Rgb255 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const css = ([r, g, b]: Rgb255, alpha?: number) =>
  alpha === undefined
    ? `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`
    : `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${alpha})`;

function rgbToHsl([r, g, b]: Rgb255): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb255 {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

/** Luminance relative (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texte posé sur la couleur principale : blanc, sauf sur une couleur très claire. */
export function inkOn(hex: string): string {
  return luminance(hex) > 0.32 ? '#141416' : '#ffffff';
}

/** Version claire de la couleur principale, pour du texte lisible sur fond sombre. */
export function brightAccent(hex: string): string {
  if (hex === DEFAULT_LOOK.accent) return '#ff5c52'; // la V1
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb(h, s < 0.08 ? s : Math.min(1, s * 1.05 + 0.05), Math.max(l, 0.64)));
}

/** Couleur des courbes et des graphiques. */
export function chartColor(appearance: Pick<Appearance, 'accent'>): string {
  return brightAccent(appearance.accent);
}

// ---------- Teinte des cartes selon le fond ----------

interface Tint {
  surface: Rgb255;
  glass: Rgb255;
  /** Couleur de la page sous le fond. */
  base: string;
}

const NEUTRAL: Rgb255 = [10, 10, 12];

export function tintFor(background: BackgroundSettings): Tint {
  if (background.kind === 'animated') {
    const preset = ANIMATED_PRESETS[background.preset];
    return { surface: preset.surface, glass: preset.glass, base: preset.base };
  }
  if (background.kind === 'image') {
    return { surface: [20, 20, 24], glass: [38, 38, 44], base: '#0e0e10' };
  }
  const color =
    background.kind === 'gradient'
      ? mix(hexToRgb(background.color), hexToRgb(background.color2), 0.5)
      : hexToRgb(background.color);
  return {
    surface: mix(color, NEUTRAL, 0.84),
    glass: mix(color, NEUTRAL, 0.7),
    base: background.color,
  };
}

// ---------- Coins, police, taille du texte ----------

/** Rayons des coins (variables de Tailwind) : ronds = la V1. */
const RADII: Record<Corners, [string, string, string]> = {
  sharp: ['0.25rem', '0.375rem', '0.5rem'],
  soft: ['0.5rem', '0.75rem', '1rem'],
  round: ['0.75rem', '1rem', '1.5rem'],
  xl: ['1rem', '1.5rem', '2rem'],
};

export const FONT_STACKS: Record<FontChoice, string> = {
  poppins: '"Poppins", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  system: '-apple-system, system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", system-ui, sans-serif',
  serif: 'ui-serif, "New York", Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

const TEXT_SCALE: Record<TextSize, string> = {
  small: '93.75%',
  normal: '100%',
  large: '106.25%',
  xlarge: '112.5%',
};

// ---------- Variables CSS ----------

export function appearanceVars(appearance: Appearance): Record<string, string> {
  const accent = appearance.accent;
  const bright = brightAccent(accent);
  const tint = tintFor(appearance.background);
  const glow =
    accent === DEFAULT_LOOK.accent
      ? 'rgb(220 30 40 / 0.75)' // la V1
      : css(mix(hexToRgb(accent), hexToRgb(bright), 0.5), 0.75);
  const [xl, x2, x3] = RADII[appearance.corners];
  return {
    '--color-accent': accent,
    '--color-accent-bright': bright,
    '--color-accent-ink': inkOn(accent),
    '--accent-glow': glow,
    '--color-bg': tint.base,
    '--color-surface': css(tint.surface, appearance.cardOpacity),
    '--glass-bg': css(tint.glass, Math.min(0.95, Math.round((appearance.cardOpacity + 0.04) * 100) / 100)),
    '--card-blur': `${appearance.blur}px`,
    '--glass-blur': `${Math.round(appearance.blur * 1.3)}px`,
    '--blur-xl': `${Math.round(appearance.blur * 1.2)}px`,
    '--radius-xl': xl,
    '--radius-2xl': x2,
    '--radius-3xl': x3,
    '--font-sans': FONT_STACKS[appearance.font],
  };
}

/** Pose l'apparence sur la page. Ne change que ce qui a changé. */
export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(appearanceVars(appearance))) {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
  }
  const size = TEXT_SCALE[appearance.textSize];
  if (root.style.fontSize !== size) root.style.fontSize = size;
  root.dataset.motion = appearance.motion;
  // Barre d'état et fond de l'appli sur iPhone : même teinte que la page.
  const base = tintFor(appearance.background).base;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', base);
}

// ---------- Aperçus des fonds animés ----------

const rgb01 = (c: Rgb, gain = 1) => css([c[0] * 255 * gain, c[1] * 255 * gain, c[2] * 255 * gain]);

/** Petite image (en CSS) qui évoque un fond animé, pour les vignettes de choix. */
export function presetPreview(preset: AnimatedPreset): string {
  const p = preset.palette;
  return [
    `radial-gradient(circle at 25% 28%, ${rgb01(p[1])} 0%, transparent 58%)`,
    `radial-gradient(circle at 78% 72%, ${rgb01(p[4])} 0%, transparent 52%)`,
    `radial-gradient(circle at 62% 18%, ${rgb01(p[3], 0.85)} 0%, transparent 34%)`,
    `linear-gradient(160deg, ${rgb01(p[0])}, ${rgb01(preset.shade, 2)})`,
  ].join(', ');
}

/** Couleurs des formes floues du secours sans carte graphique (la V1 garde les siennes). */
export function fallbackColors(preset: AnimatedPreset): [string, string, string, string, string] {
  if (preset.id === 'forge') return ['#0d0607', '#5a0610', '#b5121b', '#e2541b', '#a3123f'];
  const p = preset.palette;
  return [rgb01(preset.shade, 1.4), rgb01(p[2]), rgb01(p[1]), rgb01(p[3], 0.9), rgb01(p[4])];
}

/** Fond uni ou dégradé, en CSS. */
export function flatBackground(background: BackgroundSettings): string {
  return background.kind === 'gradient'
    ? `linear-gradient(165deg, ${background.color}, ${background.color2})`
    : background.color;
}
