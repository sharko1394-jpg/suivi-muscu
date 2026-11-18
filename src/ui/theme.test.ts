import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, THEME_PRESETS, normalizeAppearance, themeName } from '../data';
import { appearanceVars, brightAccent, displayedBackground, inkOn } from './theme';

describe('variables CSS du thème', () => {
  it('« Défaut » donne exactement les valeurs de la V1', () => {
    expect(appearanceVars(DEFAULT_APPEARANCE)).toEqual({
      '--color-accent': '#b5121b',
      '--color-accent-bright': '#ff5c52',
      '--color-accent-ink': '#ffffff',
      '--accent-glow': 'rgb(220 30 40 / 0.75)',
      '--color-bg': '#121213',
      '--color-surface': 'rgb(26 18 20 / 0.46)',
      '--glass-bg': 'rgb(44 30 32 / 0.5)',
      '--card-blur': '20px',
      '--glass-blur': '26px',
      '--blur-xl': '24px',
      '--radius-xl': '0.75rem',
      '--radius-2xl': '1rem',
      '--radius-3xl': '1.5rem',
      '--font-sans': '"Poppins", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    });
  });

  it('le texte sur la couleur principale reste lisible', () => {
    expect(inkOn('#b5121b')).toBe('#ffffff');
    expect(inkOn('#1a73e8')).toBe('#ffffff');
    // Couleurs claires : texte foncé.
    expect(inkOn('#e4e4e7')).toBe('#141416');
    expect(inkOn('#d4a017')).toBe('#141416');
  });

  it('la version claire de la couleur principale est assez lumineuse pour du texte', () => {
    const bright = brightAccent('#1d4ed8');
    const lightness = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    };
    expect(lightness(bright)).toBeGreaterThanOrEqual(0.63);
  });
});

describe('nom du thème affiché', () => {
  it('thème prêt à l’emploi, thème enregistré, ou « Personnalisé »', () => {
    const ocean = THEME_PRESETS.find((t) => t.id === 'ocean')!.look;
    expect(themeName(DEFAULT_APPEARANCE, [])).toBe('Défaut');
    expect(themeName({ ...DEFAULT_APPEARANCE, ...ocean }, [])).toBe('Océan');
    const mine = normalizeAppearance({ accent: '#123456' });
    expect(themeName(mine, [])).toBe('Personnalisé');
    expect(themeName(mine, [{ id: 't1', name: 'Bleu nuit', look: mine, createdAt: 0 }])).toBe('Bleu nuit');
  });
});

describe('motif (2.4)', () => {
  it('sans motif, le fond du thème ; avec un motif, des lignes de la couleur du thème', () => {
    expect(displayedBackground(DEFAULT_APPEARANCE)).toBe(DEFAULT_APPEARANCE.background);
    const red = displayedBackground({ ...DEFAULT_APPEARANCE, motif: 'contours' });
    expect(red).toMatchObject({ kind: 'pattern', pattern: 'contours', patternLine: '#ff5c52' });
    const ocean = THEME_PRESETS.find((t) => t.id === 'ocean')!.look;
    const blue = displayedBackground({ ...DEFAULT_APPEARANCE, ...ocean, motif: 'contours' });
    expect(blue.patternLine).toBe(brightAccent(ocean.accent));
    expect(blue.patternBg).not.toBe(red.patternBg);
  });

  it('un fond en lignes de la 2.3 devient le motif, et le fond redevient animé', () => {
    const fixed = normalizeAppearance({ background: { kind: 'pattern', pattern: 'waves', preset: 'ocean' } });
    expect(fixed.motif).toBe('waves');
    expect(fixed.background).toMatchObject({ kind: 'animated', preset: 'ocean' });
    expect(normalizeAppearance({ motif: 'inconnu' }).motif).toBeNull();
  });
});
