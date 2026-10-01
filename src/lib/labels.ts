import type { AnomalyStatus, PatrolStatus } from './types';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

export const NAV_STATE: Record<string, { label: string; tone: Tone }> = {
  FOLLOWING: { label: 'Berjalan', tone: 'ok' },
  APPROACHING: { label: 'Menuju titik', tone: 'info' },
  DWELLING: { label: 'Inspeksi', tone: 'info' },
  GOAL_REACHED: { label: 'Selesai', tone: 'info' },
  PAUSED: { label: 'Dijeda', tone: 'warn' },
  NAV_INACTIVE: { label: 'Siaga', tone: 'muted' },
  NO_PATH: { label: 'Tanpa rute', tone: 'muted' },
  EMERGENCY_STOP: { label: 'Rem darurat', tone: 'danger' },
  BLOCKED: { label: 'Terhalang', tone: 'danger' },
  OFF_PATH: { label: 'Keluar rute', tone: 'danger' },
  TF_UNAVAILABLE: { label: 'Posisi hilang', tone: 'danger' },
  AVOIDANCE_STALE: { label: 'Sensor macet', tone: 'danger' },
};

export const navState = (state: string | undefined) => NAV_STATE[state ?? ''] ?? { label: state ?? '—', tone: 'muted' as Tone };

export const PATROL_STATUS: Record<PatrolStatus, { label: string; tone: Tone }> = {
  requested: { label: 'Dikirim', tone: 'info' },
  running: { label: 'Berjalan', tone: 'ok' },
  finished: { label: 'Selesai', tone: 'muted' },
  stopped: { label: 'Dihentikan', tone: 'warn' },
  failed: { label: 'Gagal', tone: 'danger' },
};

export const ANOMALY_STATUS: Record<AnomalyStatus, { label: string; tone: Tone }> = {
  queued: { label: 'Antri', tone: 'muted' },
  analyzing: { label: 'Dianalisis', tone: 'info' },
  needs_validation: { label: 'Perlu validasi', tone: 'warn' },
  confirmed: { label: 'Terkonfirmasi', tone: 'danger' },
  rejected: { label: 'Ditolak', tone: 'muted' },
  dismissed: { label: 'Diabaikan', tone: 'muted' },
};

export const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const EVENT_LABEL: Record<string, string> = {
  arrived: 'Tiba di titik',
  inspected: 'Inspeksi selesai',
  departed: 'Berangkat',
  skipped: 'Titik dilewati',
  started: 'Patroli dimulai',
  lap: 'Putaran selesai',
  finished: 'Patroli selesai',
  alert: 'Peringatan',
};
