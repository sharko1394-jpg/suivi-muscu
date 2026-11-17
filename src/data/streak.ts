import { db, type AppDB } from './db';
import { getSettings } from './settings';
import type { ID, Program, ProgramWorkout, Session, Weekday } from './types';
import { DAY_MS, localDate } from './util';

// Séances d'affilée « sans en rater une ».
//
// Une séance est ratée quand :
//  - jours fixes : un jour prévu passe, et rien n'est fait avant le jour prévu suivant
//    (la séance du lundi faite le mardi compte) ;
//  - rotation : une séance est passée (« Passer cette séance ») sans entraînement ce jour-là ;
//  - dans tous les cas : plus de 7 jours de repos d'affilée.
//
// Tout est recalculé à partir de l'historique : rien n'est stocké en dehors des séances passées
// de la rotation. Corriger ou supprimer une séance met la série à jour aussitôt.

/** Au-delà de 7 jours de repos d'affilée, la série s'arrête. */
export const STREAK_MAX_REST_DAYS = 7;

const noon = (day: string) => new Date(`${day}T12:00:00`).getTime();
/** Jour décalé de `days` jours (midi : un changement d'heure ne fait pas sauter de jour). */
export const addDays = (day: string, days: number) => localDate(noon(day) + days * DAY_MS);
export const daysBetween = (from: string, to: string) => Math.round((noon(to) - noon(from)) / DAY_MS);

function weekdayOf(day: string): Weekday {
  const d = new Date(`${day}T12:00:00`).getDay();
  return (d === 0 ? 7 : d) as Weekday;
}

/** Premier jour prévu strictement après `day`. */
function nextPlanned(day: string, weekdays: Weekday[]): string {
  let next = addDays(day, 1);
  while (!weekdays.includes(weekdayOf(next))) next = addDays(next, 1);
  return next;
}

/** Planning en jours fixes d'un programme, sur la période où on l'a suivi. */
export interface ScheduleRun {
  weekdays: Weekday[];
  /** Premier et dernier jour (inclus) où ce planning s'applique. */
  from: string;
  to: string;
}

export interface StreakInput {
  /** Un jour par séance terminée (deux séances le même jour : deux fois le jour). */
  sessionDates: string[];
  today: string;
  schedules: ScheduleRun[];
  /** Jours où une séance de la rotation a été passée. */
  skips: string[];
}

export interface SessionStreak {
  /** Séances d'affilée, sans en rater une, jusqu'à aujourd'hui. */
  current: number;
  /** Meilleure série jamais faite. */
  best: number;
  /** Dernier jour pour s'entraîner sans casser la série ; null quand la série est à zéro. */
  keepBy: string | null;
  /** Séances faites et ratées, de la plus ancienne à la plus récente (12 au plus). */
  recent: ('done' | 'missed')[];
}

/** Jours où une séance a été ratée, dans l'ordre. Rien n'est raté avant la toute première séance. */
export function streakMisses({ sessionDates, today, schedules, skips }: StreakInput): string[] {
  const done = new Set(sessionDates);
  const days = [...done].sort();
  if (days.length === 0) return [];
  const first = days[0];
  const misses = new Set<string>();

  // Jours fixes : chaque jour prévu ouvre un créneau qui dure jusqu'au jour prévu suivant.
  for (const run of schedules) {
    if (run.weekdays.length === 0) continue;
    const to = run.to < today ? run.to : today;
    for (let day = run.from < first ? first : run.from; day <= to; day = addDays(day, 1)) {
      if (!run.weekdays.includes(weekdayOf(day))) continue;
      const end = nextPlanned(day, run.weekdays);
      if (end > today) continue; // créneau pas encore fini
      let found = false;
      for (let d = day; d < end && !found; d = addDays(d, 1)) found = done.has(d);
      if (!found) misses.add(day);
    }
  }

  // Rotation : une séance passée, sans entraînement ce jour-là.
  for (const day of skips) {
    if (day >= first && day <= today && !done.has(day)) misses.add(day);
  }

  // Partout : plus de 7 jours de repos d'affilée (aujourd'hui n'est pas fini, il ne compte pas).
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i - 1], days[i]) - 1 > STREAK_MAX_REST_DAYS) misses.add(addDays(days[i - 1], 1));
  }
  const last = days[days.length - 1];
  if (daysBetween(last, today) - 1 > STREAK_MAX_REST_DAYS) misses.add(addDays(last, 1));

  return [...misses].sort();
}

export function sessionStreak(input: StreakInput): SessionStreak {
  const misses = streakMisses(input);
  const sessions = [...input.sessionDates].sort();
  const timeline: ('done' | 'missed')[] = [];
  let run = 0;
  let best = 0;
  let m = 0;
  for (const date of sessions) {
    // Une absence casse la série : on repart de zéro.
    while (m < misses.length && misses[m] <= date) {
      timeline.push('missed');
      run = 0;
      m++;
    }
    timeline.push('done');
    run++;
    if (run > best) best = run;
  }
  if (m < misses.length) {
    timeline.push('missed');
    run = 0;
  }
  return {
    current: run,
    best,
    keepBy: run > 0 ? keepBy(input, sessions[sessions.length - 1]) : null,
    recent: timeline.slice(-12),
  };
}

/** Dernier jour pour s'entraîner sans casser la série. */
function keepBy({ sessionDates, today, schedules }: StreakInput, last: string): string {
  let deadline = addDays(last, STREAK_MAX_REST_DAYS + 1);
  // Le planning suivi aujourd'hui : le créneau en cours (ou le suivant, s'il est déjà fait).
  const run = schedules.find((s) => s.to >= today && s.from <= today && s.weekdays.length > 0);
  if (run) {
    const done = new Set(sessionDates);
    let start: string | null = null;
    for (let day = today; day >= run.from && daysBetween(day, today) < 7; day = addDays(day, -1)) {
      if (run.weekdays.includes(weekdayOf(day))) {
        start = day;
        break;
      }
    }
    let slotEnd: string;
    if (start === null) {
      // Pas encore de jour prévu : le premier créneau commence au prochain jour prévu.
      slotEnd = addDays(nextPlanned(nextPlanned(addDays(today, -1), run.weekdays), run.weekdays), -1);
    } else {
      const end = nextPlanned(start, run.weekdays);
      let found = false;
      for (let d = start; d <= today && !found; d = addDays(d, 1)) found = done.has(d);
      // Créneau en cours déjà fait : c'est le suivant qu'il faudra tenir.
      slotEnd = addDays(found ? nextPlanned(end, run.weekdays) : end, -1);
    }
    if (slotEnd < deadline) deadline = slotEnd;
  }
  return deadline;
}

/**
 * Plannings en jours fixes suivis au fil du temps.
 * L'historique dit quel programme on suivait (chaque séance garde son programme) ;
 * chaque programme est jugé sur la période où on l'a suivi, avec ses jours actuels.
 */
export function scheduleRuns(
  sessions: Session[],
  programs: Program[],
  workouts: ProgramWorkout[],
  today: string,
): ScheduleRun[] {
  const byId = new Map(programs.map((p) => [p.id, p]));
  const workoutIds = new Set(workouts.map((w) => w.id));
  const linked = sessions
    .filter((s) => s.status === 'done' && s.programId !== null)
    .sort((a, b) => a.startedAt - b.startedAt);
  const runs: { programId: ID; from: string; last: string }[] = [];
  for (const session of linked) {
    const current = runs[runs.length - 1];
    if (current && current.programId === session.programId) current.last = session.date;
    else runs.push({ programId: session.programId!, from: session.date, last: session.date });
  }
  const active = programs.find((p) => p.status === 'active');
  const result: ScheduleRun[] = [];
  runs.forEach((run, index) => {
    const program = byId.get(run.programId);
    if (!program || program.scheduleMode !== 'fixedDays') return;
    const weekdays = (Object.entries(program.fixedDays) as [string, ID | undefined][])
      .filter(([, id]) => id !== undefined && workoutIds.has(id))
      .map(([day]) => Number(day) as Weekday);
    if (weekdays.length === 0) return;
    const next = runs[index + 1];
    const to = next ? addDays(next.from, -1) : active?.id === run.programId ? today : run.last;
    result.push({ weekdays, from: run.from, to });
  });
  return result;
}

export async function getSessionStreak(now: number = Date.now(), database: AppDB = db): Promise<SessionStreak> {
  const [sessions, programs, workouts, settings] = await Promise.all([
    database.sessions.where('status').equals('done').toArray(),
    database.programs.toArray(),
    database.programWorkouts.toArray(),
    getSettings(database),
  ]);
  const today = localDate(now);
  return sessionStreak({
    sessionDates: sessions.map((s) => s.date),
    today,
    schedules: scheduleRuns(sessions, programs, workouts, today),
    skips: settings.skipLog,
  });
}
