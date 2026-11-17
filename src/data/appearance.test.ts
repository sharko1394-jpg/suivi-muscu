import { describe, expect, it } from 'vitest';
import {
  addCustomBackground,
  applyLook,
  deleteCustomBackground,
  deleteSavedTheme,
  exportThemeFile,
  getAppearance,
  getCustomBackground,
  importThemeFile,
  listCustomBackgrounds,
  parseThemeFile,
  renameSavedTheme,
  resetAppearance,
  saveCurrentTheme,
  updateAppearance,
} from './appearance';
import {
  ANIMATED_PRESETS,
  DEFAULT_APPEARANCE,
  MAX_CUSTOM_BACKGROUNDS,
  THEME_PRESETS,
  matchingPreset,
  normalizeAppearance,
  visibleTabs,
} from './appearanceModel';
import { exportBackup, importBackup, parseBackup } from './backup';
import { CURRENT_VERSION } from './schema';
import { getSettings } from './settings';
import { freshDb } from '../test/helpers';

/** Plus petite image PNG valide (1 × 1 pixel). */
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const photo = (name = 'Salle') => ({ name, dataUrl: PIXEL, width: 1, height: 1 });

describe('thème « Défaut » = la V1', () => {
  it('reprend exactement l’apparence de la V1', () => {
    expect(DEFAULT_APPEARANCE).toMatchObject({
      accent: '#b5121b',
      cardOpacity: 0.46,
      blur: 20,
      corners: 'round',
      font: 'poppins',
      textSize: 'normal',
      motion: 'auto',
      effects: { ripples: true, recordWave: true, restBreath: true },
      background: { kind: 'animated', preset: 'forge', speed: 1, intensity: 1 },
    });
  });

  it('onglets et accueil de base (ils ne font pas partie du thème)', () => {
    expect(DEFAULT_APPEARANCE.tabs).toEqual({
      order: ['today', 'program', 'history', 'stats', 'coach', 'library', 'settings'],
      hidden: [],
      labels: {},
      labelMode: 'active',
      style: 'floating',
      start: 'today',
    });
    // Depuis la 2.1 : la série de séances d'affilée et les objectifs, côte à côte.
    expect(DEFAULT_APPEARANCE.home).toEqual([
      { id: 'plan', size: 'large' },
      { id: 'streak', size: 'small' },
      { id: 'goals', size: 'small' },
      { id: 'doneToday', size: 'large' },
    ]);
  });

  it('le fond « Forge » garde les couleurs de la V1', () => {
    const forge = ANIMATED_PRESETS.forge;
    expect(forge.palette).toEqual([
      [0.3, 0.02, 0.08],
      [0.8, 0.06, 0.12],
      [0.52, 0.01, 0.03],
      [0.98, 0.34, 0.08],
      [0.78, 0.1, 0.38],
    ]);
    expect(forge.surface).toEqual([26, 18, 20]);
    expect(forge.glass).toEqual([44, 30, 32]);
  });

  it('un téléphone qui n’a jamais rien personnalisé est en « Défaut »', async () => {
    const database = await freshDb();
    const appearance = await getAppearance(database);
    expect(appearance).toEqual(normalizeAppearance(DEFAULT_APPEARANCE));
    expect(matchingPreset(appearance)?.id).toBe('defaut');
    database.close();
  });

  it('la V2 ne change pas la forme de la base : la V1 peut toujours rouvrir les données', () => {
    expect(CURRENT_VERSION).toBe(1);
  });
});

describe('réglages abîmés ou venus d’ailleurs', () => {
  it('les valeurs impossibles sont remplacées, sans rien casser', () => {
    const fixed = normalizeAppearance({
      accent: 'rouge',
      cardOpacity: 7,
      blur: -3,
      corners: 'triangle',
      font: 'Comic Sans',
      textSize: 'géant',
      background: { kind: 'image', imageId: null, speed: 99 },
      tabs: {
        order: ['stats', 'stats', 'inconnu'],
        hidden: ['today', 'settings', 'coach'],
        labels: { stats: '  Mes courbes  ', program: '', settings: 'Un nom vraiment beaucoup trop long' },
        start: 'coach',
      },
      home: [{ id: 'records', size: 'énorme' }, { id: 'inconnu' }, { id: 'records', size: 'small' }],
      homeVersion: 2,
    });
    expect(fixed.accent).toBe('#b5121b');
    expect(fixed.cardOpacity).toBe(0.9);
    expect(fixed.blur).toBe(0);
    expect(fixed.corners).toBe('round');
    expect(fixed.font).toBe('poppins');
    expect(fixed.textSize).toBe('normal');
    // Une photo sans référence : retour au fond animé.
    expect(fixed.background.kind).toBe('animated');
    expect(fixed.background.speed).toBe(2);
    // Tous les onglets restent rangés quelque part, sans doublon : les absents reprennent leur place d'origine.
    expect(fixed.tabs.order).toEqual(['today', 'program', 'history', 'stats', 'coach', 'library', 'settings']);
    // Aujourd'hui et Réglages ne peuvent pas être masqués.
    expect(fixed.tabs.hidden).toEqual(['coach']);
    expect(fixed.tabs.labels).toEqual({ stats: 'Mes courbes', settings: 'Un nom vraimen' });
    // Un onglet masqué ne peut pas s'ouvrir au démarrage.
    expect(fixed.tabs.start).toBe('today');
    expect(visibleTabs(fixed.tabs)).toEqual(['today', 'program', 'history', 'stats', 'library', 'settings']);
    // La séance du jour revient toujours sur l'accueil ; widgets inconnus et doublons écartés.
    expect(fixed.home).toEqual([
      { id: 'plan', size: 'large' },
      { id: 'records', size: 'small' },
    ]);
  });

  it('un widget ne prend que les tailles qu’il sait afficher', () => {
    const fixed = normalizeAppearance({
      homeVersion: 2,
      home: [{ id: 'plan', size: 'small' }, { id: 'volume', size: 'small' }],
    });
    expect(fixed.home).toEqual([
      { id: 'plan', size: 'large' },
      { id: 'volume', size: 'large' },
    ]);
  });
});

describe('nouveautés de la 2.1 sur une personnalisation déjà enregistrée', () => {
  // Ce que la 2.0 enregistrait : six onglets, pas de numéro de version de l'accueil.
  const saved20 = {
    tabs: { order: ['today', 'coach', 'stats', 'program', 'history', 'settings'], hidden: ['history'] },
    home: [
      { id: 'plan', size: 'large' },
      { id: 'week', size: 'small' },
      { id: 'records', size: 'small' },
    ],
  };

  it('la Bibliothèque se range juste après Conseils, même dans un ordre personnalisé', () => {
    const appearance = normalizeAppearance(saved20);
    expect(appearance.tabs.order).toEqual(['today', 'coach', 'library', 'stats', 'program', 'history', 'settings']);
    expect(appearance.tabs.hidden).toEqual(['history']);
  });

  it('la série et les objectifs arrivent une fois sur l’accueil, juste après la séance du jour', () => {
    const appearance = normalizeAppearance(saved20);
    expect(appearance.home).toEqual([
      { id: 'plan', size: 'large' },
      { id: 'streak', size: 'small' },
      { id: 'goals', size: 'small' },
      { id: 'week', size: 'small' },
      { id: 'records', size: 'small' },
    ]);
    expect(appearance.homeVersion).toBe(2);
  });

  it('un widget de base retiré ne revient pas', async () => {
    const database = await freshDb();
    await database.settings.put({ key: 'appearance', value: saved20, updatedAt: 0 });
    await updateAppearance(
      (current) => ({ home: current.home.filter((slot) => slot.id !== 'streak') }),
      database,
    );
    const appearance = await getAppearance(database);
    expect(appearance.home.map((slot) => slot.id)).toEqual(['plan', 'goals', 'week', 'records']);
    database.close();
  });
});

describe('changer l’apparence', () => {
  it('chaque changement est enregistré, sans effacer les autres', async () => {
    const database = await freshDb();
    await Promise.all([
      updateAppearance({ accent: '#1a73e8' }, database),
      updateAppearance((current) => ({ tabs: { ...current.tabs, labelMode: 'always' } }), database),
      updateAppearance({ textSize: 'large' }, database),
    ]);
    const appearance = await getAppearance(database);
    expect(appearance.accent).toBe('#1a73e8');
    expect(appearance.tabs.labelMode).toBe('always');
    expect(appearance.textSize).toBe('large');
    database.close();
  });

  it('un thème change les couleurs et le fond, pas les onglets, l’accueil ni la taille du texte', async () => {
    const database = await freshDb();
    await updateAppearance(
      { textSize: 'xlarge', home: [{ id: 'plan', size: 'large' }, { id: 'week', size: 'small' }] },
      database,
    );
    const ocean = THEME_PRESETS.find((t) => t.id === 'ocean')!;
    await applyLook(ocean.look, database);
    const appearance = await getAppearance(database);
    expect(appearance.background.preset).toBe('ocean');
    expect(appearance.accent).toBe(ANIMATED_PRESETS.ocean.accent);
    expect(appearance.textSize).toBe('xlarge');
    expect(appearance.home).toEqual([
      { id: 'plan', size: 'large' },
      { id: 'week', size: 'small' },
    ]);
    expect(matchingPreset(appearance)?.id).toBe('ocean');
    database.close();
  });

  it('« par défaut » remet la V1, mais garde mes photos et mes thèmes', async () => {
    const database = await freshDb();
    await addCustomBackground(photo(), database);
    await saveCurrentTheme('Ma photo', database);
    await updateAppearance({ accent: '#16a34a', textSize: 'small' }, database);
    await resetAppearance(database);
    expect(await getAppearance(database)).toEqual(normalizeAppearance(DEFAULT_APPEARANCE));
    expect(await listCustomBackgrounds(database)).toHaveLength(1);
    expect((await getSettings(database)).savedThemes).toHaveLength(1);
    database.close();
  });
});

describe('mes thèmes', () => {
  it('enregistrer, renommer, supprimer', async () => {
    const database = await freshDb();
    await updateAppearance({ accent: '#db2777' }, database);
    const theme = await saveCurrentTheme('  Rose   bonbon ', database);
    expect(theme.name).toBe('Rose bonbon');
    expect(theme.look.accent).toBe('#db2777');

    await renameSavedTheme(theme.id, 'Rose', database);
    expect((await getSettings(database)).savedThemes.map((t) => t.name)).toEqual(['Rose']);

    await deleteSavedTheme(theme.id, database);
    expect((await getSettings(database)).savedThemes).toEqual([]);
    database.close();
  });

  it('un nom vide est refusé', async () => {
    const database = await freshDb();
    await expect(saveCurrentTheme('   ', database)).rejects.toThrow('Donne un nom');
    database.close();
  });
});

describe('mes photos de fond', () => {
  it('une photo ajoutée devient le fond, et reste à part des réglages', async () => {
    const database = await freshDb();
    const bg = await addCustomBackground(photo(), database);
    const appearance = await getAppearance(database);
    expect(appearance.background).toMatchObject({ kind: 'image', imageId: bg.id });
    expect((await getCustomBackground(bg.id, database))?.dataUrl).toBe(PIXEL);
    // Les réglages ne relisent pas les photos.
    expect(Object.keys(await getSettings(database))).not.toContain(`fond:${bg.id}`);
    database.close();
  });

  it('refuse ce qui n’est pas une image, et au-delà du nombre maximal', async () => {
    const database = await freshDb();
    await expect(
      addCustomBackground({ ...photo(), dataUrl: 'https://exemple.fr/image.jpg' }, database),
    ).rejects.toThrow('ne peut pas servir de fond');
    await expect(
      addCustomBackground({ ...photo(), dataUrl: `${PIXEL}") , url("https://exemple.fr/x.png` }, database),
    ).rejects.toThrow();
    for (let i = 0; i < MAX_CUSTOM_BACKGROUNDS; i++) await addCustomBackground(photo(`P${i}`), database);
    await expect(addCustomBackground(photo('Une de trop'), database)).rejects.toThrow('supprimes-en une');
    database.close();
  });

  it('supprimer la photo affichée ramène le fond animé', async () => {
    const database = await freshDb();
    const bg = await addCustomBackground(photo(), database);
    await deleteCustomBackground(bg.id, database);
    expect((await getAppearance(database)).background).toMatchObject({ kind: 'animated', imageId: null });
    expect(await listCustomBackgrounds(database)).toEqual([]);
    database.close();
  });
});

describe('partager sa personnalisation', () => {
  it('le fichier emporte la photo affichée, et s’applique sur un autre téléphone', async () => {
    const mine = await freshDb();
    const bg = await addCustomBackground(photo('Plage'), mine);
    await updateAppearance(
      (current) => ({
        accent: '#0d9488',
        corners: 'xl',
        tabs: { ...current.tabs, hidden: ['coach'], labelMode: 'never' },
      }),
      mine,
    );
    const text = JSON.stringify(await exportThemeFile('Été', mine));

    const friend = await freshDb();
    const file = parseThemeFile(text);
    expect(file.backgrounds.map((b) => b.id)).toEqual([bg.id]);
    await importThemeFile(file, friend);
    const appearance = await getAppearance(friend);
    expect(appearance).toMatchObject({ accent: '#0d9488', corners: 'xl', background: { kind: 'image', imageId: bg.id } });
    expect(appearance.tabs.hidden).toEqual(['coach']);
    expect((await getCustomBackground(bg.id, friend))?.name).toBe('Plage');
    const { savedThemes } = await getSettings(friend);
    expect(savedThemes.map((t) => t.name)).toEqual(['Été']);

    // Réimporter le même fichier ne crée pas de doublon.
    await importThemeFile(parseThemeFile(text), friend);
    expect(await listCustomBackgrounds(friend)).toHaveLength(1);
    expect((await getSettings(friend)).savedThemes).toHaveLength(1);
    mine.close();
    friend.close();
  });

  it('refuse les fichiers qui ne sont pas des thèmes de l’appli', () => {
    expect(() => parseThemeFile('pas du json')).toThrow('illisible');
    expect(() => parseThemeFile(JSON.stringify({ app: 'autre-appli' }))).toThrow('pas un thème');
    expect(() => parseThemeFile(JSON.stringify({ app: 'suivi-muscu-theme', version: 99 }))).toThrow(
      'plus récente',
    );
  });

  it('une photo manquante dans le fichier : le reste s’applique, avec le fond animé', async () => {
    const database = await freshDb();
    await importThemeFile(
      parseThemeFile(
        JSON.stringify({
          app: 'suivi-muscu-theme',
          version: 1,
          name: 'Incomplet',
          appearance: { accent: '#7c3aed', background: { kind: 'image', imageId: 'absente' } },
          backgrounds: [],
        }),
      ),
      database,
    );
    const appearance = await getAppearance(database);
    expect(appearance.accent).toBe('#7c3aed');
    expect(appearance.background).toMatchObject({ kind: 'animated', imageId: null });
    database.close();
  });
});

describe('sauvegarde complète', () => {
  it('la personnalisation et les photos partent dans la sauvegarde et reviennent à l’import', async () => {
    const phone = await freshDb();
    const bg = await addCustomBackground(photo(), phone);
    await updateAppearance({ accent: '#d4a017', font: 'serif' }, phone);
    await saveCurrentTheme('Doré', phone);
    const file = JSON.stringify(await exportBackup('2.0.0', phone));

    const newPhone = await freshDb();
    await importBackup(parseBackup(file), newPhone);
    const appearance = await getAppearance(newPhone);
    expect(appearance).toMatchObject({ accent: '#d4a017', font: 'serif', background: { imageId: bg.id } });
    expect((await getCustomBackground(bg.id, newPhone))?.dataUrl).toBe(PIXEL);
    expect((await getSettings(newPhone)).savedThemes.map((t) => t.name)).toEqual(['Doré']);
    phone.close();
    newPhone.close();
  });
});
