import { describe, expect, it } from 'vitest';
import { addDays, scheduleRuns, sessionStreak, streakMisses } from './streak';
import type { Program, ProgramWorkout, Session } from './types';

// Novembre 2026 : le 2 est un lundi.
const MON_WED_FRI = [1, 3, 5] as const;

describe('séances d’affilée sans programme ou en rotation', () => {
  it('compte toutes les séances tant qu’on ne reste pas plus de 7 jours sans s’entraîner', () => {
    const streak = sessionStreak({
      sessionDates: ['2026-11-02', '2026-11-04', '2026-11-06'],
      today: '2026-11-07',
      schedules: [],
      skips: [],
    });
    expect(streak.current).toBe(3);
    expect(streak.best).toBe(3);
    // Dernier jour pour s'entraîner : 8 jours après la dernière séance.
    expect(streak.keepBy).toBe('2026-11-14');
    expect(streak.recent).toEqual(['done', 'done', 'done']);
  });

  it('plus de 7 jours de repos cassent la série', () => {
    const streak = sessionStreak({
      sessionDates: ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-20', '2026-10-22'],
      today: '2026-10-23',
      schedules: [],
      skips: [],
    });
    expect(streak.current).toBe(2);
    expect(streak.best).toBe(3);
    expect(streak.recent).toEqual(['done', 'done', 'done', 'missed', 'done', 'done']);
  });

  it('aujourd’hui n’est pas fini : 7 jours de repos passent, le 8e casse la série', () => {
    const base = { sessionDates: ['2026-11-01'], schedules: [], skips: [] };
    expect(sessionStreak({ ...base, today: '2026-11-09' })).toMatchObject({ current: 1, keepBy: '2026-11-09' });
    expect(sessionStreak({ ...base, today: '2026-11-10' })).toMatchObject({ current: 0, best: 1, keepBy: null });
  });

  it('rotation : passer une séance sans s’entraîner ce jour-là casse la série', () => {
    const dates = ['2026-11-02', '2026-11-04', '2026-11-06'];
    const skipped = sessionStreak({ sessionDates: dates, today: '2026-11-06', schedules: [], skips: ['2026-11-05'] });
    expect(skipped.current).toBe(1);
    expect(skipped.best).toBe(2);
    // Passée, puis une autre séance faite le même jour : rien n'est raté.
    const trained = sessionStreak({ sessionDates: dates, today: '2026-11-06', schedules: [], skips: ['2026-11-04'] });
    expect(trained.current).toBe(3);
  });

  it('deux séances le même jour comptent pour deux', () => {
    const streak = sessionStreak({ sessionDates: ['2026-11-02', '2026-11-02'], today: '2026-11-02', schedules: [], skips: [] });
    expect(streak.current).toBe(2);
  });

  it('rien n’est raté avant la toute première séance', () => {
    expect(streakMisses({ sessionDates: [], today: '2026-11-20', schedules: [], skips: ['2026-11-03'] })).toEqual([]);
  });
});

describe('séances d’affilée en jours fixes', () => {
  const run = { weekdays: [...MON_WED_FRI], from: '2026-11-02', to: '2026-11-30' };

  it('la séance du vendredi faite le samedi compte : le créneau dure jusqu’au jour prévu suivant', () => {
    const streak = sessionStreak({
      sessionDates: ['2026-11-02', '2026-11-04', '2026-11-07', '2026-11-09'],
      today: '2026-11-12',
      schedules: [{ ...run, to: '2026-11-12' }],
      skips: [],
    });
    expect(streak.current).toBe(4);
    // Le créneau du mercredi 11 n'est pas fait : il faut s'entraîner au plus tard jeudi 12.
    expect(streak.keepBy).toBe('2026-11-12');
  });

  it('un créneau entier sans séance casse la série', () => {
    const streak = sessionStreak({
      sessionDates: ['2026-11-02', '2026-11-04', '2026-11-09'],
      today: '2026-11-10',
      schedules: [{ ...run, to: '2026-11-10' }],
      skips: [],
    });
    expect(streakMisses({ sessionDates: ['2026-11-02', '2026-11-04', '2026-11-09'], today: '2026-11-10', schedules: [{ ...run, to: '2026-11-10' }], skips: [] })).toEqual(['2026-11-06']);
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(2);
  });

  it('créneau du jour déjà fait : c’est le suivant qu’il faudra tenir', () => {
    const streak = sessionStreak({
      sessionDates: ['2026-11-09', '2026-11-11'],
      today: '2026-11-11',
      schedules: [{ ...run, from: '2026-11-09', to: '2026-11-11' }],
      skips: [],
    });
    expect(streak.current).toBe(2);
    // Le vendredi 13 ouvre le créneau suivant, qui dure jusqu'au dimanche 15.
    expect(streak.keepBy).toBe('2026-11-15');
  });
});

describe('plannings suivis au fil du temps', () => {
  const program = (id: string, mode: Program['scheduleMode'], status: Program['status']): Program => ({
    id,
    name: id,
    status,
    scheduleMode: mode,
    fixedDays: { 1: `${id}-w`, 4: `${id}-w` },
    rotation: [`${id}-w`],
    nextRotationIndex: 0,
    createdAt: 0,
    updatedAt: 0,
  });
  const workout = (programId: string): ProgramWorkout => ({
    id: `${programId}-w`,
    programId,
    name: 'Séance',
    order: 0,
    items: [],
    createdAt: 0,
    updatedAt: 0,
  });
  const session = (id: string, date: string, programId: string | null): Session => {
    const t = new Date(`${date}T18:00:00`).getTime();
    return {
      id,
      status: 'done',
      startedAt: t,
      endedAt: t + 3_600_000,
      date,
      programId,
      programName: programId,
      workoutId: programId ? `${programId}-w` : null,
      workoutName: 'Séance',
      note: '',
      createdAt: t,
      updatedAt: t,
    };
  };

  it('chaque programme en jours fixes est jugé sur la période où on l’a suivi', () => {
    const runs = scheduleRuns(
      [
        session('s1', '2026-10-05', 'a'),
        session('s2', '2026-10-08', 'a'),
        session('s3', '2026-10-12', null), // séance libre : ne change pas de période
        session('s4', '2026-10-20', 'b'),
        session('s5', '2026-11-02', 'a'),
      ],
      [program('a', 'fixedDays', 'active'), program('b', 'rotation', 'inactive')],
      [workout('a'), workout('b')],
      '2026-11-05',
    );
    expect(runs).toEqual([
      { weekdays: [1, 4], from: '2026-10-05', to: '2026-10-19' },
      { weekdays: [1, 4], from: '2026-11-02', to: '2026-11-05' },
    ]);
  });

  it('un programme qui n’est plus actif s’arrête à sa dernière séance', () => {
    const runs = scheduleRuns(
      [session('s1', '2026-10-05', 'a'), session('s2', '2026-10-08', 'a')],
      [program('a', 'fixedDays', 'inactive')],
      [workout('a')],
      '2026-11-05',
    );
    expect(runs).toEqual([{ weekdays: [1, 4], from: '2026-10-05', to: '2026-10-08' }]);
  });

  it('les jours se décalent correctement, même au changement d’heure', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });
});
