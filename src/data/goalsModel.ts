// Objectifs personnels : définitions pures (aucun accès à la base).
//
// Ils vivent dans le réglage `personalGoals` (tiroir `settings`) : la forme de la base ne change
// pas (toujours la version 1), donc la V1 peut toujours rouvrir les données.

/**
 * - lift : une charge sur un exercice, pour au moins N répétitions (0 kg = N répétitions au poids du corps) ;
 * - bodyweight : un poids de corps à atteindre ;
 * - sessions : un nombre de séances à faire à partir du jour où l'objectif est fixé.
 */
export type PersonalGoalKind = 'lift' | 'bodyweight' | 'sessions';

export interface PersonalGoal {
  id: string;
  kind: PersonalGoalKind;
  /** Exercice visé (objectif « lift » seulement). */
  exerciseId: string | null;
  /** Charge visée (kg), poids de corps visé (kg) ou nombre de séances. */
  target: number;
  /** Répétitions visées (objectif « lift »), 1 sinon. */
  reps: number;
  /** Point de départ noté à la création : meilleure performance, poids du moment, ou 0 séance. */
  start: number;
  /** Date limite facultative, 'AAAA-MM-JJ'. */
  deadline: string | null;
  createdAt: number;
}

export const MAX_PERSONAL_GOALS = 20;

export const GOAL_LIMITS = {
  weight: { min: 0, max: 1000 },
  reps: { min: 1, max: 100 },
  sessions: { min: 1, max: 1000 },
} as const;

const KINDS: PersonalGoalKind[] = ['lift', 'bodyweight', 'sessions'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Jour 'AAAA-MM-JJ' qui existe vraiment. */
export function isValidDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Objectifs lus dans les réglages : un objectif abîmé est écarté, sans rien casser. */
export function normalizeGoals(raw: unknown): PersonalGoal[] {
  if (!Array.isArray(raw)) return [];
  const goals: PersonalGoal[] = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.id !== 'string' || item.id === '') continue;
    if (goals.some((g) => g.id === item.id)) continue;
    const kind = KINDS.find((k) => k === item.kind);
    if (!kind) continue;
    const target = Number(item.target);
    const start = Number(item.start);
    if (!Number.isFinite(target) || target < 0 || !Number.isFinite(start)) continue;
    const exerciseId = kind === 'lift' && typeof item.exerciseId === 'string' ? item.exerciseId : null;
    if (kind === 'lift' && exerciseId === null) continue;
    const reps = Math.round(Number(item.reps));
    goals.push({
      id: item.id,
      kind,
      exerciseId,
      target,
      reps: kind === 'lift' && reps >= GOAL_LIMITS.reps.min && reps <= GOAL_LIMITS.reps.max ? reps : 1,
      start,
      deadline: isValidDay(item.deadline) ? item.deadline : null,
      createdAt: typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : 0,
    });
  }
  return goals.slice(0, MAX_PERSONAL_GOALS);
}

/** Liste de jours 'AAAA-MM-JJ' valides, sans doublon, les plus récents gardés. */
export function normalizeDays(raw: unknown, max = 400): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isValidDay))].sort().slice(-max);
}
