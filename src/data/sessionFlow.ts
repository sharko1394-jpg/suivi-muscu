// Enchaînement des séries pendant une séance. Calculs purs, sans accès à la base.

export interface FlowExercise {
  id: string;
  supersetGroup: string | null;
  /** Repos après une série de cet exercice, en secondes. */
  restSec: number;
  sets: { id: string; done: boolean }[];
}

interface Step {
  setId: string;
  exerciseId: string;
  done: boolean;
  /** Numéro du bloc : un exercice seul, ou un superset entier. */
  block: number;
  /** Tour dans le bloc : toutes les séries n° 1, puis toutes les n° 2… */
  round: number;
}

/**
 * Ordre conseillé des séries.
 * Exercice seul : ses séries à la suite.
 * Superset : une série de chaque exercice à tour de rôle (A1, B1, A2, B2…).
 */
export function orderedSteps(exercises: FlowExercise[]): Step[] {
  const steps: Step[] = [];
  let block = 0;
  let index = 0;
  while (index < exercises.length) {
    const group = exercises[index].supersetGroup;
    let end = index + 1;
    if (group !== null) {
      while (end < exercises.length && exercises[end].supersetGroup === group) end++;
    }
    const members = exercises.slice(index, end);
    const rounds = Math.max(0, ...members.map((m) => m.sets.length));
    for (let round = 0; round < rounds; round++) {
      for (const member of members) {
        const set = member.sets[round];
        if (set) steps.push({ setId: set.id, exerciseId: member.id, done: set.done, block, round });
      }
    }
    block++;
    index = end;
  }
  return steps;
}

/**
 * Prochaine série à faire après `afterSetId` (ou depuis le début si null).
 * Arrivé au bout, on revient aux séries sautées plus haut. null quand tout est fait.
 */
export function nextSetId(exercises: FlowExercise[], afterSetId: string | null): string | null {
  const steps = orderedSteps(exercises);
  const start = afterSetId === null ? -1 : steps.findIndex((step) => step.setId === afterSetId);
  for (let offset = 1; offset <= steps.length; offset++) {
    const step = steps[(start + offset + steps.length) % steps.length];
    if (!step.done && step.setId !== afterSetId) return step.setId;
  }
  return null;
}

/**
 * Repos à lancer une fois la série `setId` validée, en secondes.
 * 0 s'il ne reste rien à faire, ou si l'on enchaîne tout de suite sur l'exercice suivant
 * du même superset : le repos démarre après le dernier exercice du groupe.
 */
export function restAfter(exercises: FlowExercise[], setId: string): number {
  const steps = orderedSteps(exercises).map((step) =>
    step.setId === setId ? { ...step, done: true } : step,
  );
  const current = steps.find((step) => step.setId === setId);
  if (!current) return 0;
  const nextId = nextSetId(
    exercises.map((e) => ({
      ...e,
      sets: e.sets.map((s) => (s.id === setId ? { ...s, done: true } : s)),
    })),
    setId,
  );
  if (nextId === null) return 0;
  const next = steps.find((step) => step.setId === nextId)!;
  const sameSupersetRound =
    next.block === current.block && next.round === current.round && next.exerciseId !== current.exerciseId;
  if (sameSupersetRound) return 0;
  return exercises.find((e) => e.id === current.exerciseId)?.restSec ?? 0;
}
