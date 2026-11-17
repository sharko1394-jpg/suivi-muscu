import {
  BACKGROUND_KEY_PREFIX,
  DEFAULT_APPEARANCE,
  MAX_CUSTOM_BACKGROUNDS,
  MAX_SAVED_THEMES,
  SAVED_THEME_NAME_MAX,
  THEME_FILE_APP,
  THEME_FILE_VERSION,
  isValidImageDataUrl,
  lookOf,
  lookSignature,
  normalizeAppearance,
  normalizeCustomBackground,
  normalizeLook,
  type Appearance,
  type CustomBackground,
  type Look,
  type SavedTheme,
  type ThemeFile,
} from './appearanceModel';
import { db, type AppDB } from './db';
import { getSettings, setSetting } from './settings';
import { AppError, newId } from './util';

// Enregistrement de la personnalisation. Tout passe par le tiroir `settings` :
// le réglage `appearance`, le réglage `savedThemes`, et une ligne « fond:<id> » par photo.

export async function getAppearance(database: AppDB = db): Promise<Appearance> {
  return (await getSettings(database)).appearance;
}

/**
 * Change l'apparence. `change` reçoit l'apparence actuelle et renvoie la nouvelle (ou seulement
 * ce qui change). Lecture et écriture dans la même transaction : deux réglages touchés coup sur coup
 * ne s'écrasent pas.
 */
export async function updateAppearance(
  change: Partial<Appearance> | ((current: Appearance) => Partial<Appearance>),
  database: AppDB = db,
): Promise<Appearance> {
  return database.transaction('rw', database.settings, async () => {
    const current = await getAppearance(database);
    const patch = typeof change === 'function' ? change(current) : change;
    const next = normalizeAppearance({ ...current, ...patch });
    await setSetting('appearance', next, database);
    return next;
  });
}

/** Applique un thème : couleurs, fond, verre, coins et police. Le reste (onglets, accueil, texte) ne bouge pas. */
export function applyLook(look: Look, database: AppDB = db): Promise<Appearance> {
  return updateAppearance(lookOf(look), database);
}

/** Tout revient comme dans la V1. Les photos et les thèmes enregistrés sont gardés. */
export async function resetAppearance(database: AppDB = db): Promise<void> {
  await setSetting('appearance', DEFAULT_APPEARANCE, database);
}

// ---------- Mes thèmes ----------

function cleanThemeName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean === '') throw new AppError('Donne un nom à ce thème.');
  if (clean.length > SAVED_THEME_NAME_MAX) {
    throw new AppError(`Nom trop long (${SAVED_THEME_NAME_MAX} caractères au plus).`);
  }
  return clean;
}

/** Enregistre l'apparence actuelle comme thème, pour y revenir d'un appui. */
export async function saveCurrentTheme(name: string, database: AppDB = db): Promise<SavedTheme> {
  const clean = cleanThemeName(name);
  return database.transaction('rw', database.settings, async () => {
    const { appearance, savedThemes } = await getSettings(database);
    if (savedThemes.length >= MAX_SAVED_THEMES) {
      throw new AppError(`Tu as déjà ${MAX_SAVED_THEMES} thèmes : supprimes-en un d’abord.`);
    }
    const theme: SavedTheme = { id: newId(), name: clean, look: lookOf(appearance), createdAt: Date.now() };
    await setSetting('savedThemes', [...savedThemes, theme], database);
    return theme;
  });
}

export async function renameSavedTheme(id: string, name: string, database: AppDB = db): Promise<void> {
  const clean = cleanThemeName(name);
  await database.transaction('rw', database.settings, async () => {
    const { savedThemes } = await getSettings(database);
    await setSetting(
      'savedThemes',
      savedThemes.map((t) => (t.id === id ? { ...t, name: clean } : t)),
      database,
    );
  });
}

export async function deleteSavedTheme(id: string, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const { savedThemes } = await getSettings(database);
    await setSetting(
      'savedThemes',
      savedThemes.filter((t) => t.id !== id),
      database,
    );
  });
}

// ---------- Mes photos de fond ----------

const backgroundKey = (id: string) => `${BACKGROUND_KEY_PREFIX}${id}`;

function backgroundRows(database: AppDB) {
  return database.settings.where('key').startsWith(BACKGROUND_KEY_PREFIX);
}

/** Toutes les photos de fond, de la plus ancienne à la plus récente. */
export async function listCustomBackgrounds(database: AppDB = db): Promise<CustomBackground[]> {
  const rows = await backgroundRows(database).toArray();
  return rows
    .map((row) => normalizeCustomBackground(row.value))
    .filter((bg): bg is CustomBackground => bg !== null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function getCustomBackground(
  id: string,
  database: AppDB = db,
): Promise<CustomBackground | undefined> {
  const row = await database.settings.get(backgroundKey(id));
  return row ? (normalizeCustomBackground(row.value) ?? undefined) : undefined;
}

/**
 * Ajoute une photo (déjà réduite par l'écran) et l'affiche aussitôt en fond.
 * Elle est enregistrée dans la base : elle part donc dans les sauvegardes.
 */
export async function addCustomBackground(
  input: { name: string; dataUrl: string; width: number; height: number },
  database: AppDB = db,
): Promise<CustomBackground> {
  if (!isValidImageDataUrl(input.dataUrl)) {
    throw new AppError('Cette image ne peut pas servir de fond.');
  }
  return database.transaction('rw', database.settings, async () => {
    if ((await backgroundRows(database).count()) >= MAX_CUSTOM_BACKGROUNDS) {
      throw new AppError(`Tu as déjà ${MAX_CUSTOM_BACKGROUNDS} photos de fond : supprimes-en une d’abord.`);
    }
    const background: CustomBackground = {
      id: newId(),
      name: input.name.trim().slice(0, 40) || 'Photo',
      dataUrl: input.dataUrl,
      width: Math.round(input.width),
      height: Math.round(input.height),
      createdAt: Date.now(),
    };
    await database.settings.put({ key: backgroundKey(background.id), value: background, updatedAt: Date.now() });
    await updateAppearance(
      (current) => ({ background: { ...current.background, kind: 'image', imageId: background.id } }),
      database,
    );
    return background;
  });
}

/** Supprime une photo. Si elle était affichée, le fond animé revient. */
export async function deleteCustomBackground(id: string, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    await database.settings.delete(backgroundKey(id));
    await updateAppearance((current) =>
      current.background.imageId === id
        ? { background: { ...current.background, kind: 'animated', imageId: null } }
        : {},
    database);
  });
}

// ---------- Partager sa personnalisation ----------

export function themeFileName(now: number = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `suivi-muscu-theme-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

/** Toute la personnalisation, avec la photo de fond affichée, dans un fichier à garder ou à partager. */
export async function exportThemeFile(name: string, database: AppDB = db): Promise<ThemeFile> {
  const appearance = await getAppearance(database);
  const imageId = appearance.background.kind === 'image' ? appearance.background.imageId : null;
  const image = imageId ? await getCustomBackground(imageId, database) : undefined;
  return {
    app: THEME_FILE_APP,
    version: THEME_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    name: name.trim().slice(0, SAVED_THEME_NAME_MAX) || 'Ma personnalisation',
    appearance,
    backgrounds: image ? [image] : [],
  };
}

/** Lit et vérifie un fichier de personnalisation. Ne touche pas à la base. */
export function parseThemeFile(text: string): ThemeFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError('Ce fichier est illisible : ce n’est pas un thème valide.');
  }
  const r = raw as Record<string, unknown> | null;
  if (typeof r !== 'object' || r === null || r.app !== THEME_FILE_APP) {
    throw new AppError('Ce fichier n’est pas un thème de cette appli.');
  }
  if (typeof r.version !== 'number' || r.version > THEME_FILE_VERSION) {
    throw new AppError('Ce thème vient d’une version plus récente de l’appli. Mets l’appli à jour, puis réessaie.');
  }
  const backgrounds = (Array.isArray(r.backgrounds) ? r.backgrounds : [])
    .map(normalizeCustomBackground)
    .filter((bg): bg is CustomBackground => bg !== null);
  return {
    app: THEME_FILE_APP,
    version: r.version,
    exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : new Date(0).toISOString(),
    name:
      typeof r.name === 'string' && r.name.trim() !== ''
        ? r.name.trim().slice(0, SAVED_THEME_NAME_MAX)
        : 'Thème importé',
    appearance: normalizeAppearance(r.appearance),
    backgrounds,
  };
}

/**
 * Applique un fichier de personnalisation : ses photos rejoignent « mes fonds »,
 * et son thème rejoint « mes thèmes » pour pouvoir y revenir.
 */
export async function importThemeFile(file: ThemeFile, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const existing = await listCustomBackgrounds(database);
    const missing = file.backgrounds.filter((bg) => !existing.some((e) => e.id === bg.id));
    if (existing.length + missing.length > MAX_CUSTOM_BACKGROUNDS) {
      throw new AppError(
        `Ce thème apporte une photo, mais tu as déjà ${MAX_CUSTOM_BACKGROUNDS} photos de fond : supprimes-en une d’abord.`,
      );
    }
    for (const bg of missing) {
      await database.settings.put({ key: backgroundKey(bg.id), value: bg, updatedAt: Date.now() });
    }

    // Une photo absente du fichier (et du téléphone) : on garde le reste, avec le fond animé.
    let appearance = file.appearance;
    const imageId = appearance.background.imageId;
    if (
      appearance.background.kind === 'image' &&
      !existing.some((e) => e.id === imageId) &&
      !missing.some((m) => m.id === imageId)
    ) {
      appearance = { ...appearance, background: { ...appearance.background, kind: 'animated', imageId: null } };
    }
    await setSetting('appearance', normalizeAppearance(appearance), database);

    const { savedThemes } = await getSettings(database);
    const look = normalizeLook(appearance);
    const known = savedThemes.some((t) => lookSignature(t.look) === lookSignature(look));
    if (!known && savedThemes.length < MAX_SAVED_THEMES) {
      await setSetting(
        'savedThemes',
        [...savedThemes, { id: newId(), name: file.name, look, createdAt: Date.now() }],
        database,
      );
    }
  });
}
