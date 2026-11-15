// Modèle de données de l'appli.
// Toute modification de ces formes sur des données déjà enregistrées
// exige une nouvelle version dans schema.ts, avec sa migration.

export type ID = string;

/** Champs communs à toutes les lignes (préparent une future synchro). */
export interface Row {
  id: ID;
  createdAt: number;
  updatedAt: number;
}

// ---------- Exercices ----------

export type Muscle =
  | 'pectoraux'
  | 'dos'
  | 'epaules'
  | 'trapezes'
  | 'biceps'
  | 'triceps'
  | 'avant-bras'
  | 'abdominaux'
  | 'lombaires'
  | 'quadriceps'
  | 'ischios'
  | 'fessiers'
  | 'adducteurs'
  | 'abducteurs'
  | 'mollets';

export type Equipment =
  | 'barre'
  | 'halteres'
  | 'machine'
  | 'poulie'
  | 'smith'
  | 'poids-du-corps'
  | 'kettlebell'
  | 'elastique'
  | 'autre';

export interface Exercise extends Row {
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  /** true = créé par l'utilisateur, false = fourni avec l'appli. */
  isCustom: boolean;
  /** Masqué des listes, mais conservé pour l'historique. */
  archived: boolean;
  /** Pas des boutons +/− propre à cet exercice ; null = réglage général. */
  weightStep: number | null;
}

// ---------- Programme ----------

export type ScheduleMode = 'fixedDays' | 'rotation';
/** Jour ISO : 1 = lundi … 7 = dimanche. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Program extends Row {
  name: string;
  /** Un seul programme 'active' à la fois. */
  status: 'active' | 'inactive' | 'archived';
  scheduleMode: ScheduleMode;
  /** Mode jours fixes : jour → séance du programme. */
  fixedDays: Partial<Record<Weekday, ID>>;
  /** Mode rotation : ordre des séances dans le cycle. */
  rotation: ID[];
  /** Mode rotation : position de la prochaine séance dans le cycle. */
  nextRotationIndex: number;
}

export interface PlannedExercise {
  id: ID;
  exerciseId: ID;
  sets: number;
  repMin: number;
  repMax: number;
  targetWeight: number | null;
  restSec: number;
  /** Note permanente, ex. « siège cran 4 ». */
  note: string;
  /** Les exercices partageant la même valeur forment un superset. */
  supersetGroup: string | null;
}

export interface ProgramWorkout extends Row {
  programId: ID;
  name: string;
  order: number;
  items: PlannedExercise[];
}

// ---------- Séances réalisées (historique figé) ----------

export interface Session extends Row {
  status: 'inProgress' | 'done';
  startedAt: number;
  endedAt: number | null;
  /** Jour local de la séance, 'AAAA-MM-JJ'. */
  date: string;
  /** Copies figées : l'historique ne dépend plus du programme. */
  programId: ID | null;
  programName: string | null;
  workoutId: ID | null;
  workoutName: string;
  note: string;
}

export interface PlannedSnapshot {
  sets: number;
  repMin: number;
  repMax: number;
  targetWeight: number | null;
  restSec: number;
  note: string;
}

export interface SessionExercise extends Row {
  sessionId: ID;
  order: number;
  exerciseId: ID;
  /** Copies figées de l'exercice au moment de la séance. */
  exerciseName: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  /** Ce qui était prévu par le programme ; null pour un exercice ajouté à la volée. */
  planned: PlannedSnapshot | null;
  supersetGroup: string | null;
  note: string;
}

export type SetType = 'warmup' | 'normal' | 'drop' | 'failure';

export interface SetEntry extends Row {
  sessionId: ID;
  sessionExerciseId: ID;
  exerciseId: ID;
  order: number;
  type: SetType;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  done: boolean;
  completedAt: number | null;
}

// ---------- Divers ----------

export interface Bodyweight extends Row {
  /** 'AAAA-MM-JJ', une seule pesée par jour. */
  date: string;
  weightKg: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: number;
}

/** Contenu brut de la base : nom de tiroir → lignes. Sert aux migrations et aux sauvegardes. */
export type Dump = Record<string, unknown[]>;
