export interface Pose {
  x: number;
  y: number;
  yaw: number;
}

export interface Battery {
  pct: number | null;
  v: number | null;
  a: number | null;
  temp: number | null;
}

export interface PatrolRef {
  patrol_id: number | null;
  route_id: number | null;
}

export interface Telemetry {
  type: 'telemetry';
  ts: number;
  pose: Pose | null;
  mode: 'auto' | 'remote';
  nav: { state: string; message: string };
  mission: string;
  localization: string;
  battery: Battery | null;
  driver: { level: number; msg: string } | null;
  people: number;
  health: { ok: boolean; issues: string[] } | null;
  patrol: PatrolRef | null;
}

export interface Robot {
  id: string;
  name: string;
  floor_plan_id: number | null;
  last_seen: string | null;
  last_telemetry: Telemetry | null;
  online: boolean;
  created_at: string;
}

export type RoutePoint = [x: number, y: number, yawDeg: number, dwellSec: number];

export interface Route {
  id: number;
  uid: string;
  robot_id: string;
  name: string;
  recorded_at: string;
  length_m: number;
  stops: number;
  closed: boolean;
  archived: boolean;
  created_at: string;
  points?: RoutePoint[];
}

export interface Schedule {
  id: number;
  robot_id: string;
  route_id: number;
  name: string;
  days: number[];
  time_of_day: string;
  enabled: boolean;
  last_run_on: string | null;
  once_on: string | null;
}

export type PatrolStatus = 'requested' | 'running' | 'finished' | 'stopped' | 'failed';

export interface Patrol {
  id: number;
  robot_id: string;
  route_id: number | null;
  schedule_id: number | null;
  status: PatrolStatus;
  message: string;
  laps: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface PatrolRecap {
  anomalies: Record<string, number>;
  events: Record<string, number>;
  crowd_peak: number;
}

export type AnomalyStatus = 'queued' | 'analyzing' | 'needs_validation' | 'confirmed' | 'rejected' | 'dismissed';

export interface Anomaly {
  id: number;
  uid: string;
  robot_id: string;
  patrol_id: number | null;
  route_id: number | null;
  detected_at: string;
  early_category: string;
  early_confidence: number;
  early_note: string;
  final_category: string | null;
  final_confidence: number | null;
  final_note: string;
  x: number | null;
  y: number | null;
  yaw: number | null;
  stop_index: number | null;
  status: AnomalyStatus;
  validated_by: string | null;
  validated_at: string | null;
  notified_at: string | null;
  created_at: string;
}

export interface Rule {
  category: string;
  label: string;
  requires_validation: boolean;
  notify_telegram: boolean;
  telegram_chat_id: string;
  min_confidence: number;
}

export interface FloorPlan {
  id: number;
  name: string;
  content_type: string;
  width_px: number;
  height_px: number;
  origin_x_px: number;
  origin_y_px: number;
  px_per_m: number;
  rotation_rad: number;
  created_at: string;
}

export interface HeatCell {
  x: number;
  y: number;
  size: number;
  peak: number;
  mean: number;
  samples: number;
}

export interface TimelinePoint {
  bucket: string;
  peak: number;
}

export interface NetraEvent {
  id: number;
  robot_id: string;
  patrol_id: number | null;
  type: string;
  payload: Record<string, unknown>;
  ts: string;
}

export type LiveMessage =
  | { type: 'telemetry'; robot_id: string; data: Telemetry }
  | { type: 'robot_online'; robot_id: string; online: boolean }
  | { type: 'anomaly'; robot_id?: string; id: number; status: AnomalyStatus; category?: string }
  | { type: 'patrol_event' | 'stop_event' | 'alert' | 'crowd' | 'ack' | 'hello'; robot_id: string; data: Record<string, unknown> }
  | { type: 'patrol_requested'; robot_id: string; patrol_id: number }
  | { type: 'route'; robot_id: string; id: number };

export type Permission = 'view' | 'operate' | 'configure' | 'audit' | 'users';
export type Role = 'viewer' | 'operator' | 'supervisor' | 'admin';

export interface Me {
  username: string;
  display_name: string;
  role: Role;
  permissions: Permission[];
  timezone: string;
}

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  disabled: boolean;
  last_login: string | null;
  created_at: string;
}

export interface AuditEntry {
  ts: string;
  username: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  ip: string;
}

export interface TrackPoint {
  ts: string;
  x: number | null;
  y: number | null;
  yaw: number | null;
  battery: number | null;
  nav_state: string;
  people: number;
}
