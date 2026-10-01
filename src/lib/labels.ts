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
};

export const navTone = (state: string | undefined): Tone => NAV_TONE[state ?? ''] ?? 'muted';

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
