import type { SetEntry } from './types';

// Calculs purs : aucune lecture ni écriture dans la base.

/** Une série qui compte : une charge (0 = poids du corps) soulevée un certain nombre de fois. */
export interface Lift {
  weight: number;
  reps: number;
}

/**
 * Une série compte pour le volume, les records et les statistiques si elle est validée,
 * complète, et n'est pas un échauffement.
 */
export function isCountedSet(set: SetEntry): set is SetEntry & Lift {
  return (
    set.done && set.type !== 'warmup' && set.weight !== null && set.reps !== null && set.reps >= 1
  );
}

// ---------- 1RM estimé ----------

/** Au-delà de 12 répétitions, la formule d'Epley n'est plus fiable : on n'estime pas. */
export const E1RM_MAX_REPS = 12;

/**
 * Charge maximale estimée sur une répétition (formule d'Epley), arrondie à 0,1 kg.
 * null si l'estimation n'a pas de sens (poids du corps seul, trop de répétitions).
 */
export function epley1RM(weight: number, reps: number): number | null {
  if (weight <= 0 || reps < 1 || reps > E1RM_MAX_REPS) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// ---------- Volume ----------

/** Volume d'une série : charge × répétitions (0 si la série ne compte pas). */
export function setVolume(set: SetEntry): number {
  return isCountedSet(set) ? set.weight * set.reps : 0;
}

/** Volume total : somme des charges × répétitions des séries qui comptent. */
export function totalVolume(sets: SetEntry[]): number {
  return Math.round(sets.reduce((sum, set) => sum + setVolume(set), 0) * 100) / 100;
}

// ---------- Records ----------

/**
 * Les trois façons de battre un record sur un exercice :
 *  - weight : charge la plus lourde jamais soulevée ;
 *  - e1rm   : meilleur 1RM estimé ;
 *  - reps   : plus de répétitions que jamais à cette même charge.
 */
export type RecordKind = 'weight' | 'e1rm' | 'reps';

export const RECORD_LABELS: Record<RecordKind, string> = {
  weight: 'Charge la plus lourde',
  e1rm: 'Meilleur 1RM estimé',
  reps: 'Plus de répétitions à cette charge',
};

/** Meilleures performances connues sur un exercice, mises à jour série après série. */
export interface RunningRecords {
  maxWeight: number | null;
  bestE1rm: number | null;
  /** Charge → plus grand nombre de répétitions déjà fait à cette charge. */
  maxRepsAtWeight: Map<number, number>;
}

export function emptyRecords(): RunningRecords {
  return { maxWeight: null, bestE1rm: null, maxRepsAtWeight: new Map() };
}

export function addLift(records: RunningRecords, lift: Lift): void {
  if (records.maxWeight === null || lift.weight > records.maxWeight) records.maxWeight = lift.weight;
  const e1rm = epley1RM(lift.weight, lift.reps);
  if (e1rm !== null && (records.bestE1rm === null || e1rm > records.bestE1rm)) {
    records.bestE1rm = e1rm;
  }
  const reps = records.maxRepsAtWeight.get(lift.weight);
  if (reps === undefined || lift.reps > reps) records.maxRepsAtWeight.set(lift.weight, lift.reps);
}

export function recordsFrom(lifts: Lift[]): RunningRecords {
  const records = emptyRecords();
  for (const lift of lifts) addLift(records, lift);
  return records;
}

/**
 * Records battus par une série. Il faut faire strictement mieux : égaler ne suffit pas.
 * Sans performance antérieure comparable, il n'y a rien à battre.
 */
export function recordsBeaten(records: RunningRecords, lift: Lift): RecordKind[] {
  const beaten: RecordKind[] = [];
  if (records.maxWeight !== null && lift.weight > records.maxWeight) beaten.push('weight');
  const e1rm = epley1RM(lift.weight, lift.reps);
  if (e1rm !== null && records.bestE1rm !== null && e1rm > records.bestE1rm) beaten.push('e1rm');
  const reps = records.maxRepsAtWeight.get(lift.weight);
  if (reps !== undefined && lift.reps > reps) beaten.push('reps');
  return beaten;
}

/**
 * Pour les séries d'une séance (dans l'ordre où elles ont été faites), indique lesquelles
 * battent un record, compte tenu de l'historique et des séries précédentes de la séance.
 * La toute première séance d'un exercice sert de référence : elle ne bat aucun record.
 */
export function annotateRecords(history: Lift[], sessionSets: SetEntry[]): Map<string, RecordKind[]> {
  const result = new Map<string, RecordKind[]>();
  if (history.length === 0) return result;
  const records = recordsFrom(history);
  const ordered = sessionSets
    .filter(isCountedSet)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.order - b.order);
  for (const set of ordered) {
    const beaten = recordsBeaten(records, set);
    if (beaten.length > 0) result.set(set.id, beaten);
    addLift(records, set);
  }
  return result;
}
