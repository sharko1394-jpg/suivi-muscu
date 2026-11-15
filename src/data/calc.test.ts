import { describe, expect, it } from 'vitest';
import {
  annotateRecords,
  epley1RM,
  isCountedSet,
  recordsBeaten,
  recordsFrom,
  setVolume,
  totalVolume,
  type Lift,
} from './calc';
import { nextSetId, orderedSteps, restAfter, type FlowExercise } from './sessionFlow';
import type { SetEntry } from './types';

let counter = 0;
function set(weight: number | null, reps: number | null, extra: Partial<SetEntry> = {}): SetEntry {
  counter++;
  return {
    id: `s${counter}`,
    sessionId: 'ses',
    sessionExerciseId: 'se',
    exerciseId: 'ex',
    order: counter,
    type: 'normal',
    weight,
    reps,
    rpe: null,
    done: true,
    completedAt: counter * 1000,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

describe('1RM estimé (formule d’Epley)', () => {
  it('1 répétition : la charge elle-même', () => {
    expect(epley1RM(100, 1)).toBe(100);
  });

  it('charge × (1 + répétitions / 30), arrondi à 0,1 kg', () => {
    expect(epley1RM(100, 10)).toBe(133.3);
    expect(epley1RM(80, 8)).toBe(101.3);
    expect(epley1RM(60, 5)).toBe(70);
    expect(epley1RM(82.5, 3)).toBe(90.8);
  });

  it('pas d’estimation au poids du corps seul ni au-delà de 12 répétitions', () => {
    expect(epley1RM(0, 10)).toBeNull();
    expect(epley1RM(40, 13)).toBeNull();
    expect(epley1RM(40, 12)).toBe(56);
    expect(epley1RM(40, 0)).toBeNull();
  });
});

describe('séries qui comptent et volume', () => {
  it('une série compte si elle est validée, complète et n’est pas un échauffement', () => {
    expect(isCountedSet(set(80, 8))).toBe(true);
    expect(isCountedSet(set(0, 12))).toBe(true);
    expect(isCountedSet(set(80, 8, { type: 'failure' }))).toBe(true);
    expect(isCountedSet(set(80, 8, { type: 'drop' }))).toBe(true);
    expect(isCountedSet(set(40, 10, { type: 'warmup' }))).toBe(false);
    expect(isCountedSet(set(80, 8, { done: false }))).toBe(false);
    expect(isCountedSet(set(null, 8))).toBe(false);
    expect(isCountedSet(set(80, null))).toBe(false);
    expect(isCountedSet(set(80, 0))).toBe(false);
  });

  it('volume = charge × répétitions, sans l’échauffement ni les séries non faites', () => {
    expect(setVolume(set(80, 8))).toBe(640);
    expect(setVolume(set(40, 10, { type: 'warmup' }))).toBe(0);
    expect(
      totalVolume([
        set(40, 10, { type: 'warmup' }),
        set(80, 8),
        set(82.5, 8),
        set(80, 7, { type: 'failure' }),
        set(80, 8, { done: false }),
        set(0, 15),
      ]),
    ).toBe(640 + 660 + 560);
  });

  it('les charges à virgule ne produisent pas d’erreur d’arrondi', () => {
    expect(totalVolume([set(1.1, 3), set(2.2, 3), set(0.1, 3)])).toBe(10.2);
  });
});

describe('records', () => {
  const history: Lift[] = [
    { weight: 80, reps: 8 },
    { weight: 80, reps: 7 },
    { weight: 85, reps: 5 },
  ];
  const records = recordsFrom(history);

  it('retient la charge max, le meilleur 1RM estimé et les répétitions par charge', () => {
    expect(records.maxWeight).toBe(85);
    expect(records.bestE1rm).toBe(101.3); // 80 × 8
    expect(records.maxRepsAtWeight.get(80)).toBe(8);
    expect(records.maxRepsAtWeight.get(85)).toBe(5);
  });

  it('charge la plus lourde', () => {
    expect(recordsBeaten(records, { weight: 87.5, reps: 1 })).toEqual(['weight']);
  });

  it('plus de répétitions à la même charge (et souvent meilleur 1RM estimé)', () => {
    expect(recordsBeaten(records, { weight: 80, reps: 9 })).toEqual(['e1rm', 'reps']);
    expect(recordsBeaten(records, { weight: 85, reps: 6 })).toEqual(['e1rm', 'reps']);
  });

  it('meilleur 1RM estimé seul', () => {
    // 70 × 12 = 98 : moins bien. 75 × 11 = 102,5 : mieux, à une charge jamais utilisée.
    expect(recordsBeaten(records, { weight: 70, reps: 12 })).toEqual([]);
    expect(recordsBeaten(records, { weight: 75, reps: 11 })).toEqual(['e1rm']);
  });

  it('égaler un record ne le bat pas', () => {
    expect(recordsBeaten(records, { weight: 80, reps: 8 })).toEqual([]);
    expect(recordsBeaten(records, { weight: 85, reps: 5 })).toEqual([]);
  });

  it('une charge jamais utilisée et plus légère n’est pas un record', () => {
    expect(recordsBeaten(records, { weight: 60, reps: 10 })).toEqual([]);
  });

  it('au poids du corps, seul le nombre de répétitions peut progresser', () => {
    const bodyweight = recordsFrom([{ weight: 0, reps: 10 }]);
    expect(recordsBeaten(bodyweight, { weight: 0, reps: 11 })).toEqual(['reps']);
    expect(recordsBeaten(bodyweight, { weight: 0, reps: 10 })).toEqual([]);
    // Premier lest : charge la plus lourde.
    expect(recordsBeaten(bodyweight, { weight: 5, reps: 5 })).toEqual(['weight']);
  });

  it('dans une séance, chaque série est jugée d’après ce qui précède', () => {
    const first = set(82.5, 8); // record : jamais fait 82,5 kg… mais 85 est plus lourd → 1RM seulement
    const second = set(82.5, 8); // égale la précédente : rien
    const third = set(82.5, 9); // une répétition de plus qu’à l’instant
    const warmup = set(100, 1, { type: 'warmup' }); // l’échauffement ne compte jamais
    const pending = set(120, 5, { done: false });
    const result = annotateRecords(history, [third, warmup, first, pending, second]);

    expect(result.get(first.id)).toEqual(['e1rm']);
    expect(result.has(second.id)).toBe(false);
    expect(result.get(third.id)).toEqual(['e1rm', 'reps']);
    expect(result.has(warmup.id)).toBe(false);
    expect(result.has(pending.id)).toBe(false);
  });

  it('la première séance d’un exercice sert de référence : aucun record', () => {
    expect(annotateRecords([], [set(60, 10), set(70, 8), set(80, 5)]).size).toBe(0);
  });
});

describe('enchaînement des séries', () => {
  const exercise = (id: string, group: string | null, done: boolean[], restSec = 120): FlowExercise => ({
    id,
    supersetGroup: group,
    restSec,
    sets: done.map((d, index) => ({ id: `${id}${index + 1}`, done: d })),
  });
  const order = (exercises: FlowExercise[]) => orderedSteps(exercises).map((s) => s.setId);

  it('exercices seuls : les séries à la suite', () => {
    const flow = [exercise('a', null, [false, false]), exercise('b', null, [false, false])];
    expect(order(flow)).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(nextSetId(flow, null)).toBe('a1');
    expect(nextSetId(flow, 'a2')).toBe('b1');
  });

  it('superset : une série de chaque exercice à tour de rôle', () => {
    const flow = [
      exercise('a', 'g', [false, false, false]),
      exercise('b', 'g', [false, false]),
      exercise('c', null, [false]),
    ];
    expect(order(flow)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'c1']);
  });

  it('la prochaine série saute celles déjà faites et revient aux séries sautées', () => {
    const flow = [exercise('a', null, [true, false]), exercise('b', null, [false, true])];
    expect(nextSetId(flow, null)).toBe('a2');
    expect(nextSetId(flow, 'b1')).toBe('a2'); // b2 est faite : retour à a2, sautée plus haut
    const allDone = [exercise('a', null, [true, true])];
    expect(nextSetId(allDone, 'a2')).toBeNull();
    expect(nextSetId([], null)).toBeNull();
  });

  it('repos : celui de l’exercice, après chaque série', () => {
    const flow = [exercise('a', null, [false, false], 150), exercise('b', null, [false], 60)];
    expect(restAfter(flow, 'a1')).toBe(150);
    expect(restAfter(flow, 'a2')).toBe(150);
  });

  it('pas de repos après la toute dernière série', () => {
    const flow = [exercise('a', null, [true, false], 150)];
    expect(restAfter(flow, 'a2')).toBe(0);
  });

  it('superset : pas de repos entre les deux exercices, repos après le dernier du groupe', () => {
    const flow = [exercise('a', 'g', [false, false], 90), exercise('b', 'g', [false, false], 120)];
    expect(restAfter(flow, 'a1')).toBe(0);
    expect(restAfter(flow, 'b1')).toBe(120);
    expect(restAfter(flow, 'b2')).toBe(120); // il reste a2 à faire
  });
});
