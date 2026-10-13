import type { AnomalyStatus, PatrolStatus } from './types';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

const NAV_TONE: Record<string, Tone> = {
  FOLLOWING: 'ok',
  APPROACHING: 'info',
  DWELLING: 'info',
  GOAL_REACHED: 'info',
  PAUSED: 'warn',
  NAV_INACTIVE: 'muted',
  NO_PATH: 'muted',
  EMERGENCY_STOP: 'danger',
  BLOCKED: 'danger',
  OFF_PATH: 'danger',
  TF_UNAVAILABLE: 'danger',
  AVOIDANCE_STALE: 'danger',
  ESTOP: 'danger',
};

export const navTone = (state: string | undefined): Tone => NAV_TONE[state ?? ''] ?? 'muted';

/** Navigation states that stop a patrol and need a person. */
export const ALARM_STATES = new Set(['EMERGENCY_STOP', 'BLOCKED', 'OFF_PATH', 'TF_UNAVAILABLE', 'AVOIDANCE_STALE']);

const FIELD_TONE: Record<string, Tone> = { off: 'muted', clear: 'ok', slow: 'warn', stop: 'warn', stale: 'danger' };
export const fieldTone = (field: string | null | undefined): Tone => FIELD_TONE[field ?? ''] ?? 'muted';

/** Health level as a tone; robots without `level` only report ok + issues. */
export function healthTone(health: { ok: boolean; level?: string } | null | undefined): Tone {
  if (!health) return 'muted';
  if (health.level === 'error') return 'danger';
  if (health.level === 'warn' || !health.ok) return 'warn';
  return 'ok';
}

export const batteryTone = (pct: number | null | undefined): Tone =>
  pct === null || pct === undefined ? 'muted' : pct < 10 ? 'danger' : pct < 25 ? 'warn' : 'ok';

export const PATROL_TONE: Record<PatrolStatus, Tone> = {
  requested: 'info',
  running: 'ok',
  finished: 'muted',
  stopped: 'warn',
  failed: 'danger',
};

export const ANOMALY_TONE: Record<AnomalyStatus, Tone> = {
  queued: 'muted',
  analyzing: 'info',
  needs_validation: 'warn',
  confirmed: 'danger',
  rejected: 'muted',
  dismissed: 'muted',
};

/** Day keys of the dictionary by JavaScript weekday (0 = Sunday). */
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
