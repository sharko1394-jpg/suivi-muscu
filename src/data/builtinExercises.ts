import type { Equipment, Muscle } from './types';

// Exercices fournis avec l'appli.
// RÈGLE : ne jamais modifier ni réutiliser un identifiant (1re colonne) déjà mis en ligne,
// l'historique de l'utilisateur y fait référence. On peut ajouter des lignes librement.

type Def = [slug: string, name: string, primary: Muscle, secondary: Muscle[], equipment: Equipment];

const DEFS: Def[] = [
  // Pectoraux
  ['developpe-couche-barre', 'Développé couché (barre)', 'pectoraux', ['triceps', 'epaules'], 'barre'],
  ['developpe-couche-halteres', 'Développé couché (haltères)', 'pectoraux', ['triceps', 'epaules'], 'halteres'],
  ['developpe-couche-smith', 'Développé couché (barre guidée)', 'pectoraux', ['triceps', 'epaules'], 'smith'],
  ['developpe-incline-barre', 'Développé incliné (barre)', 'pectoraux', ['epaules', 'triceps'], 'barre'],
  ['developpe-incline-halteres', 'Développé incliné (haltères)', 'pectoraux', ['epaules', 'triceps'], 'halteres'],
  ['developpe-incline-smith', 'Développé incliné (barre guidée)', 'pectoraux', ['epaules', 'triceps'], 'smith'],
  ['developpe-decline-barre', 'Développé décliné (barre)', 'pectoraux', ['triceps'], 'barre'],
  ['developpe-pectoraux-machine', 'Développé pectoraux (machine)', 'pectoraux', ['triceps', 'epaules'], 'machine'],
  ['developpe-incline-machine', 'Développé incliné (machine)', 'pectoraux', ['epaules', 'triceps'], 'machine'],
  ['ecarte-couche-halteres', 'Écarté couché (haltères)', 'pectoraux', ['epaules'], 'halteres'],
  ['ecarte-incline-halteres', 'Écarté incliné (haltères)', 'pectoraux', ['epaules'], 'halteres'],
  ['ecarte-poulie-vis-a-vis', 'Écarté à la poulie vis-à-vis', 'pectoraux', ['epaules'], 'poulie'],
  ['ecarte-poulie-basse', 'Écarté à la poulie basse', 'pectoraux', ['epaules'], 'poulie'],
  ['pec-deck', 'Pec deck (butterfly)', 'pectoraux', [], 'machine'],
  ['pompes', 'Pompes', 'pectoraux', ['triceps', 'epaules'], 'poids-du-corps'],
  ['dips', 'Dips', 'pectoraux', ['triceps', 'epaules'], 'poids-du-corps'],
  ['pull-over-haltere', 'Pull-over (haltère)', 'pectoraux', ['dos'], 'halteres'],

  // Dos
  ['tractions-pronation', 'Tractions (pronation)', 'dos', ['biceps'], 'poids-du-corps'],
  ['tractions-supination', 'Tractions (supination)', 'dos', ['biceps'], 'poids-du-corps'],
  ['tractions-prise-neutre', 'Tractions (prise neutre)', 'dos', ['biceps'], 'poids-du-corps'],
  ['tractions-assistees', 'Tractions assistées (machine)', 'dos', ['biceps'], 'machine'],
  ['tirage-vertical-prise-large', 'Tirage vertical (prise large)', 'dos', ['biceps'], 'poulie'],
  ['tirage-vertical-prise-serree', 'Tirage vertical (prise serrée)', 'dos', ['biceps'], 'poulie'],
  ['tirage-vertical-supination', 'Tirage vertical (supination)', 'dos', ['biceps'], 'poulie'],
  ['tirage-horizontal-poulie', 'Tirage horizontal à la poulie', 'dos', ['biceps', 'trapezes'], 'poulie'],
  ['tirage-bras-tendus', 'Tirage bras tendus à la poulie', 'dos', ['triceps'], 'poulie'],
  ['rowing-barre', 'Rowing barre (buste penché)', 'dos', ['biceps', 'lombaires', 'trapezes'], 'barre'],
  ['rowing-haltere', 'Rowing haltère (un bras)', 'dos', ['biceps', 'trapezes'], 'halteres'],
  ['rowing-t-bar', 'Rowing T-bar', 'dos', ['biceps', 'trapezes', 'lombaires'], 'barre'],
  ['rowing-machine', 'Rowing assis (machine)', 'dos', ['biceps', 'trapezes'], 'machine'],
  ['rowing-buste-appuye', 'Rowing buste appuyé (haltères)', 'dos', ['biceps', 'trapezes'], 'halteres'],
  ['souleve-de-terre', 'Soulevé de terre', 'dos', ['fessiers', 'ischios', 'lombaires', 'trapezes'], 'barre'],
  ['extensions-lombaires', 'Extensions lombaires (banc)', 'lombaires', ['fessiers', 'ischios'], 'poids-du-corps'],

  // Trapèzes
  ['shrugs-barre', 'Shrugs (barre)', 'trapezes', [], 'barre'],
  ['shrugs-halteres', 'Shrugs (haltères)', 'trapezes', [], 'halteres'],

  // Épaules
  ['developpe-militaire-barre', 'Développé militaire (barre)', 'epaules', ['triceps', 'trapezes'], 'barre'],
  ['developpe-epaules-halteres', 'Développé épaules (haltères)', 'epaules', ['triceps', 'trapezes'], 'halteres'],
  ['developpe-epaules-machine', 'Développé épaules (machine)', 'epaules', ['triceps'], 'machine'],
  ['developpe-epaules-smith', 'Développé épaules (barre guidée)', 'epaules', ['triceps'], 'smith'],
  ['developpe-arnold', 'Développé Arnold', 'epaules', ['triceps'], 'halteres'],
  ['elevations-laterales-halteres', 'Élévations latérales (haltères)', 'epaules', ['trapezes'], 'halteres'],
  ['elevations-laterales-poulie', 'Élévations latérales (poulie)', 'epaules', ['trapezes'], 'poulie'],
  ['elevations-laterales-machine', 'Élévations latérales (machine)', 'epaules', ['trapezes'], 'machine'],
  ['elevations-frontales-halteres', 'Élévations frontales (haltères)', 'epaules', [], 'halteres'],
  ['oiseau-halteres', 'Oiseau (haltères, buste penché)', 'epaules', ['trapezes', 'dos'], 'halteres'],
  ['pec-deck-inverse', 'Pec deck inversé', 'epaules', ['trapezes', 'dos'], 'machine'],
  ['face-pull', 'Face pull', 'epaules', ['trapezes', 'dos'], 'poulie'],
  ['rowing-menton', 'Rowing menton (barre)', 'epaules', ['trapezes', 'biceps'], 'barre'],

  // Biceps
  ['curl-barre', 'Curl barre droite', 'biceps', ['avant-bras'], 'barre'],
  ['curl-barre-ez', 'Curl barre EZ', 'biceps', ['avant-bras'], 'barre'],
  ['curl-halteres', 'Curl haltères', 'biceps', ['avant-bras'], 'halteres'],
  ['curl-incline-halteres', 'Curl incliné (haltères)', 'biceps', ['avant-bras'], 'halteres'],
  ['curl-marteau', 'Curl marteau', 'biceps', ['avant-bras'], 'halteres'],
  ['curl-pupitre', 'Curl au pupitre (barre EZ)', 'biceps', ['avant-bras'], 'barre'],
  ['curl-concentre', 'Curl concentré', 'biceps', [], 'halteres'],
  ['curl-poulie-basse', 'Curl à la poulie basse', 'biceps', ['avant-bras'], 'poulie'],
  ['curl-machine', 'Curl (machine)', 'biceps', [], 'machine'],

  // Triceps
  ['extension-triceps-poulie-barre', 'Extension triceps à la poulie (barre)', 'triceps', [], 'poulie'],
  ['extension-triceps-poulie-corde', 'Extension triceps à la poulie (corde)', 'triceps', [], 'poulie'],
  ['extension-triceps-nuque-poulie', 'Extension triceps au-dessus de la tête (poulie)', 'triceps', [], 'poulie'],
  ['extension-triceps-nuque-haltere', 'Extension triceps au-dessus de la tête (haltère)', 'triceps', [], 'halteres'],
  ['barre-au-front', 'Barre au front (barre EZ)', 'triceps', [], 'barre'],
  ['developpe-couche-prise-serree', 'Développé couché prise serrée', 'triceps', ['pectoraux', 'epaules'], 'barre'],
  ['dips-banc', 'Dips entre deux bancs', 'triceps', ['pectoraux', 'epaules'], 'poids-du-corps'],
  ['dips-machine', 'Dips (machine)', 'triceps', ['pectoraux'], 'machine'],
  ['kickback-triceps', 'Kickback triceps (haltère)', 'triceps', [], 'halteres'],

  // Avant-bras
  ['curl-poignets', 'Curl poignets (barre)', 'avant-bras', [], 'barre'],
  ['curl-inverse', 'Curl inversé (barre)', 'avant-bras', ['biceps'], 'barre'],

  // Quadriceps
  ['squat-barre', 'Squat (barre)', 'quadriceps', ['fessiers', 'ischios', 'lombaires'], 'barre'],
  ['squat-avant', 'Squat avant (front squat)', 'quadriceps', ['fessiers', 'abdominaux'], 'barre'],
  ['squat-smith', 'Squat (barre guidée)', 'quadriceps', ['fessiers', 'ischios'], 'smith'],
  ['hack-squat', 'Hack squat', 'quadriceps', ['fessiers'], 'machine'],
  ['presse-a-cuisses', 'Presse à cuisses', 'quadriceps', ['fessiers', 'ischios'], 'machine'],
  ['leg-extension', 'Leg extension', 'quadriceps', [], 'machine'],
  ['fentes-halteres', 'Fentes (haltères)', 'quadriceps', ['fessiers', 'ischios'], 'halteres'],
  ['fentes-marchees', 'Fentes marchées (haltères)', 'quadriceps', ['fessiers', 'ischios'], 'halteres'],
  ['squat-bulgare', 'Squat bulgare (haltères)', 'quadriceps', ['fessiers', 'ischios'], 'halteres'],
  ['squat-gobelet', 'Squat gobelet (haltère)', 'quadriceps', ['fessiers'], 'halteres'],

  // Ischio-jambiers
  ['souleve-de-terre-roumain', 'Soulevé de terre roumain (barre)', 'ischios', ['fessiers', 'lombaires'], 'barre'],
  ['souleve-de-terre-roumain-halteres', 'Soulevé de terre roumain (haltères)', 'ischios', ['fessiers', 'lombaires'], 'halteres'],
  ['leg-curl-allonge', 'Leg curl allongé', 'ischios', [], 'machine'],
  ['leg-curl-assis', 'Leg curl assis', 'ischios', [], 'machine'],
  ['good-morning', 'Good morning', 'ischios', ['lombaires', 'fessiers'], 'barre'],

  // Fessiers, adducteurs, abducteurs
  ['hip-thrust-barre', 'Hip thrust (barre)', 'fessiers', ['ischios'], 'barre'],
  ['hip-thrust-machine', 'Hip thrust (machine)', 'fessiers', ['ischios'], 'machine'],
  ['kickback-fessiers-poulie', 'Kickback fessiers (poulie)', 'fessiers', ['ischios'], 'poulie'],
  ['abduction-machine', 'Abduction de hanche (machine)', 'abducteurs', ['fessiers'], 'machine'],
  ['adduction-machine', 'Adduction de hanche (machine)', 'adducteurs', [], 'machine'],

  // Mollets
  ['mollets-debout', 'Extensions mollets debout (machine)', 'mollets', [], 'machine'],
  ['mollets-assis', 'Extensions mollets assis (machine)', 'mollets', [], 'machine'],
  ['mollets-presse', 'Mollets à la presse', 'mollets', [], 'machine'],

  // Abdominaux
  ['crunch', 'Crunch', 'abdominaux', [], 'poids-du-corps'],
  ['crunch-poulie', 'Crunch à la poulie haute', 'abdominaux', [], 'poulie'],
  ['crunch-machine', 'Crunch (machine)', 'abdominaux', [], 'machine'],
  ['releve-de-jambes-suspendu', 'Relevé de jambes suspendu', 'abdominaux', [], 'poids-du-corps'],
  ['releve-de-genoux-chaise-romaine', 'Relevé de genoux (chaise romaine)', 'abdominaux', [], 'poids-du-corps'],
  ['roulette-abdominale', 'Roulette abdominale', 'abdominaux', ['lombaires'], 'autre'],
  ['rotations-russes', 'Rotations russes', 'abdominaux', [], 'poids-du-corps'],
];

export interface BuiltinExercise {
  id: string;
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
}

export const BUILTIN_EXERCISES: BuiltinExercise[] = DEFS.map(
  ([slug, name, primaryMuscle, secondaryMuscles, equipment]) => ({
    id: `ex-${slug}`,
    name,
    primaryMuscle,
    secondaryMuscles,
    equipment,
  }),
);
