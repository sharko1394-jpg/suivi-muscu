import type { Equipment, Muscle, SetType, Weekday } from './types';

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  7: 'Dimanche',
};

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const MUSCLE_LABELS: Record<Muscle, string> = {
  pectoraux: 'Pectoraux',
  dos: 'Dos',
  epaules: 'Épaules',
  trapezes: 'Trapèzes',
  biceps: 'Biceps',
  triceps: 'Triceps',
  'avant-bras': 'Avant-bras',
  abdominaux: 'Abdominaux',
  lombaires: 'Lombaires',
  quadriceps: 'Quadriceps',
  ischios: 'Ischio-jambiers',
  fessiers: 'Fessiers',
  adducteurs: 'Adducteurs',
  abducteurs: 'Abducteurs',
  mollets: 'Mollets',
};

export const MUSCLES = Object.keys(MUSCLE_LABELS) as Muscle[];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barre: 'Barre',
  halteres: 'Haltères',
  machine: 'Machine',
  poulie: 'Poulie',
  smith: 'Barre guidée',
  'poids-du-corps': 'Poids du corps',
  kettlebell: 'Kettlebell',
  elastique: 'Élastique',
  autre: 'Autre',
};

export const EQUIPMENTS = Object.keys(EQUIPMENT_LABELS) as Equipment[];

export const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: 'Échauffement',
  normal: 'Normale',
  drop: 'Dégressive',
  failure: 'Échec',
};
