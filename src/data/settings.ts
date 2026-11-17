import {
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  normalizeSavedThemes,
  type Appearance,
  type SavedTheme,
} from './appearanceModel';
import { db, type AppDB } from './db';

/** Objectif d'entraînement : oriente les conseils (fourchette de répétitions, volume par muscle). */
export type Goal = 'force' | 'muscle' | 'endurance';

/** Réglages de l'appli. Stockés dans la base (pas dans localStorage). */
export interface Settings {
  /** Pas des boutons +/− pour la charge, en kg. */
  weightStep: number;
  /** Pas des boutons +/− pour les répétitions. */
  repStep: number;
  /** Temps de repos par défaut, en secondes. */
  defaultRestSec: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  /** Date du premier lancement de l'appli. */
  firstLaunchAt: number | null;
  /** Date de la dernière sauvegarde (export JSON) réussie. */
  lastBackupAt: number | null;
  /** Le rappel de sauvegarde est masqué jusqu'à cette date. */
  backupSnoozedUntil: number | null;
  /** Minuteur de repos en cours. Enregistré pour survivre à une fermeture de l'appli. */
  restTimer: RestTimer | null;
  /** Mode jours fixes : séance du jour que l'utilisateur a choisi de passer. */
  skippedDay: { date: string; workoutId: string } | null;
  /** Objectif choisi dans l'onglet Conseils. */
  goal: Goal;
  /** Personnalisation (V2) : thème, fond, onglets, widgets de l'accueil. */
  appearance: Appearance;
  /** Thèmes enregistrés par l'utilisateur. */
  savedThemes: SavedTheme[];
}

export interface RestTimer {
  /** Heure de fin du repos. */
  endsAt: number;
  /** Durée totale du repos, en secondes (pour la barre de progression). */
  totalSec: number;
}

/** Pas de charge proposés pour les boutons − et +, en kg. */
export const WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 5, 10];

export const DEFAULT_SETTINGS: Settings = {
  weightStep: 2.5,
  repStep: 1,
  defaultRestSec: 120,
  soundEnabled: true,
  vibrationEnabled: true,
  firstLaunchAt: null,
  lastBackupAt: null,
  backupSnoozedUntil: null,
  restTimer: null,
  skippedDay: null,
  goal: 'muscle',
  appearance: DEFAULT_APPEARANCE,
  savedThemes: [],
};

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

export async function getSettings(database: AppDB = db): Promise<Settings> {
  // Seulement les réglages connus : les photos de fond (lignes « fond:… ») sont lourdes
  // et ne doivent pas être relues à chaque changement de réglage.
  const rows = await database.settings.bulkGet(SETTING_KEYS);
  const stored: Record<string, unknown> = {};
  for (const row of rows) {
    if (row) stored[row.key] = row.value;
  }
  const settings = { ...DEFAULT_SETTINGS, ...(stored as Partial<Settings>) };
  // Valeurs vérifiées : un réglage abîmé ou venu d'un vieux fichier ne doit rien casser.
  settings.appearance = normalizeAppearance(stored.appearance);
  settings.savedThemes = normalizeSavedThemes(stored.savedThemes);
  return settings;
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
  database: AppDB = db,
): Promise<void> {
  await database.settings.put({ key, value, updatedAt: Date.now() });
}

/** Enregistre la date du premier lancement, une seule fois. */
export async function ensureFirstLaunch(database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const row = await database.settings.get('firstLaunchAt');
    if (!row) await setSetting('firstLaunchAt', Date.now(), database);
  });
}
