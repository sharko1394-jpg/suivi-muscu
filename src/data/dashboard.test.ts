import { describe, expect, it } from 'vitest';
import { bodyweightTrend, getWeekSets, recentRecords, weekSummary } from './dashboard';
import type { Session, SessionExercise, SetEntry, SetType } from './types';
import { freshDb } from '../test/helpers';

const at = (date: string, hour = 18) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour).getTime();
};

function session(id: string, date: string, status: Session['status'] = 'done'): Session {
  const t = at(date);
  return {
    id,
    status,
    startedAt: t,
    endedAt: t + 3_600_000,
    date,
    programId: null,
    programName: null,
    workoutId: null,
    workoutName: 'Séance',
    note: '',
    createdAt: t,
    updatedAt: t,
  };
}

let counter = 0;
function set(
  sessionId: string,
  exerciseId: string,
  weight: number | null,
  reps: number,
  options: { type?: SetType; done?: boolean; order?: number } = {},
): SetEntry {
  counter++;
  return {
    id: `set-${counter}`,
    sessionId,
    sessionExerciseId: `${sessionId}-${exerciseId}`,
    exerciseId,
    order: options.order ?? counter,
    type: options.type ?? 'normal',
    weight,
    reps,
    rpe: null,
    done: options.done ?? true,
    completedAt: counter,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('widget « Cette semaine »', () => {
  it('jours du lundi au dimanche, séances de la semaine et semaines d’affilée', () => {
    // Le 18 novembre 2026 est un mercredi.
    const summary = weekSummary(['2026-11-09', '2026-11-16', '2026-11-18', '2026-11-18', '2026-11-02'], '2026-11-18');
    expect(summary.days.map((d) => d.date)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    expect(summary.days.map((d) => d.done)).toEqual([true, false, true, false, false, false, false]);
    expect(summary.days.find((d) => d.today)?.date).toBe('2026-11-18');
    expect(summary.count).toBe(3);
    expect(summary.streak).toBe(3);
  });

  it('semaine vide', () => {
    const summary = weekSummary([], '2026-11-18');
    expect(summary.count).toBe(0);
    expect(summary.streak).toBe(0);
    expect(summary.days.every((d) => !d.done)).toBe(true);
  });
});

describe('widget « Records récents »', () => {
  const names = new Map([
    ['s1-bench', 'Développé couché'],
    ['s2-bench', 'Développé couché'],
    ['s3-bench', 'Développé couché'],
    ['s3-squat', 'Squat'],
  ]);

  it('mêmes règles qu’en séance : faire strictement mieux, première fois exclue, échauffement exclu', () => {
    const sessions = [session('s1', '2026-10-01'), session('s2', '2026-11-05'), session('s3', '2026-11-12')];
    const sets = [
      set('s1', 'bench', 80, 8),
      // Égaler n'est pas battre ; l'échauffement plus lourd ne compte pas.
      set('s2', 'bench', 80, 8),
      set('s2', 'bench', 100, 1, { type: 'warmup' }),
      // Plus lourd : record de charge (et de 1RM estimé).
      set('s3', 'bench', 82.5, 8),
      // Première séance de squat : aucun record.
      set('s3', 'squat', 120, 5),
      // Série non validée : ignorée.
      set('s3', 'bench', 90, 8, { done: false }),
    ];
    const found = recentRecords(sessions, sets, names, '2026-10-20');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ exerciseName: 'Développé couché', weight: 82.5, reps: 8, date: '2026-11-12' });
    expect(found[0].kinds).toContain('weight');
  });

  it('les records plus anciens que la période ne sont pas montrés', () => {
    const sessions = [session('s1', '2026-08-01'), session('s2', '2026-08-15')];
    const sets = [set('s1', 'bench', 80, 8), set('s2', 'bench', 85, 8)];
    expect(recentRecords(sessions, sets, names, '2026-10-20')).toEqual([]);
  });
});

describe('widget « Poids de corps »', () => {
  it('dernière pesée et écart sur environ un mois', () => {
    const trend = bodyweightTrend(
      [
        { date: '2026-11-15', weightKg: 78.1 },
        { date: '2026-10-01', weightKg: 80 },
        { date: '2026-10-15', weightKg: 79.3 },
      ],
      '2026-11-17',
    );
    expect(trend.latest).toEqual({ date: '2026-11-15', weightKg: 78.1 });
    expect(trend.change).toBe(-1.2);
    expect(trend.points.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-15', '2026-11-15']);
  });

  it('une seule pesée : pas d’écart', () => {
    const trend = bodyweightTrend([{ date: '2026-11-15', weightKg: 78.1 }], '2026-11-17');
    expect(trend.change).toBeNull();
    expect(bodyweightTrend([], '2026-11-17').latest).toBeNull();
  });
});

describe('widget « Séries de la semaine »', () => {
  it('compte les séries qui comptent de la semaine, par muscle principal', async () => {
    const database = await freshDb();
    const thisWeek = session('a', '2026-11-16');
    const lastWeek = session('b', '2026-11-12');
    const ongoing = session('c', '2026-11-17', 'inProgress');
    await database.sessions.bulkAdd([thisWeek, lastWeek, ongoing]);
    const exercise = (sessionId: string, exerciseId: string, muscle: SessionExercise['primaryMuscle']): SessionExercise => ({
      id: `${sessionId}-${exerciseId}`,
      sessionId,
      order: 0,
      exerciseId,
      exerciseName: exerciseId,
      primaryMuscle: muscle,
      secondaryMuscles: [],
      equipment: 'barre',
      planned: null,
      supersetGroup: null,
      note: '',
      createdAt: 0,
      updatedAt: 0,
    });
    await database.sessionExercises.bulkAdd([
      exercise('a', 'bench', 'pectoraux'),
      exercise('a', 'row', 'dos'),
      exercise('b', 'bench', 'pectoraux'),
      exercise('c', 'bench', 'pectoraux'),
    ]);
    await database.sets.bulkAdd([
      set('a', 'bench', 80, 8),
      set('a', 'bench', 80, 8),
      set('a', 'bench', 40, 10, { type: 'warmup' }),
      set('a', 'row', 60, 10),
      set('b', 'bench', 80, 8),
      set('c', 'bench', 80, 8),
    ]);
    const week = await getWeekSets(at('2026-11-18'), database);
    expect(week.muscles).toEqual([
      { muscle: 'pectoraux', sets: 2 },
      { muscle: 'dos', sets: 1 },
    ]);
    expect(week.total).toBe(3);
    database.close();
  });
});
