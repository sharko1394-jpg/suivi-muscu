// Adresses des pages ajoutées en 2.1, dans un petit fichier à part : les liens n'obligent pas
// à charger les pages elles-mêmes (elles ne se chargent qu'à l'ouverture).

export const GOALS_PATH = '/objectifs';

/** Bilan du mois ('AAAA-MM') ou de l'année ('AAAA'). */
export const recapPath = (key: string) => `/historique/bilan/${key}`;

export const LIBRARY_PATH = '/bibliotheque';

export const libraryExercisePath = (exerciseId: string) => `${LIBRARY_PATH}/${encodeURIComponent(exerciseId)}`;

export const PROFILE_PATH = '/reglages/profil';

export const NUTRITION_PATH = '/nutrition';
