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

/** Protective field of the control mux: off, clear, slow (scaled down), stop, stale (no safety scan). */
export type FieldState = 'off' | 'clear' | 'slow' | 'stop' | 'stale';

export interface Health {
  ok: boolean;
  /** ok, warn (degraded) or error (cannot patrol); older robots send only ok and issues. */
  level?: 'ok' | 'warn' | 'error';
  issues: string[];
  cpu_temp_c?: number | null;
  memory_percent?: number | null;
  disk_free_gb?: number | null;
  cpu_percent?: number | null;
  /** null when the robot computer is not a Jetson */
  gpu_percent?: number | null;
  memory_used_gb?: number | null;
  memory_total_gb?: number | null;
}

export type DetectorState = 'loading' | 'running' | 'off' | 'error';

/** On-robot AI inspection; interval_sec 0 = continuous, > 0 = every N s, < 0 = at stop points only. */
export interface InspectionStatus {
  enabled: boolean;
  state: DetectorState;
  error: string | null;
  model: string | null;
  interval_sec: number;
}

export interface PeopleDetectionStatus {
  enabled: boolean;
  state: DetectorState;
  error: string | null;
  count: number | null;
  backend: string | null;
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
  health: Health | null;
  patrol: PatrolRef | null;
  /** Software e-stop latched in the control mux (robots before the e-stop feature omit it). */
  estop?: boolean;
  field?: FieldState | string | null;
  inspection?: InspectionStatus | null;
  people_detection?: PeopleDetectionStatus | null;
}

export interface Robot {
  id: string;
  name: string;
  floor_plan_id: number | null;
  last_seen: string | null;
  last_telemetry: Telemetry | null;
  online: boolean;
  created_at: string;
  /** Seconds the robot clock is behind the server (negative: ahead); null until measured. */
  clock_skew_s?: number | null;
}

export type RobotCommand = 'pause' | 'resume' | 'localize' | 'stop_patrol' | 'estop' | 'estop_release';

export interface ServerInfo {
  public_url: string;
  time_zone: string;
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

/** Third-party application on the integration API (/api/ext/v1); its secret is shown only once. */
export interface ApiClient {
  id: number;
  client_id: string;
  name: string;
  scopes: string[];
  enabled: boolean;
  created_by: string;
  created_at: string;
  last_used_at: string | null;
}

/** A client secret, as answered once by create and rotate. */
export interface ApiClientSecret {
  client_id: string;
  client_secret: string;
}

export interface TrackPoint {
  ts: string;
  x: number | null;
  y: number | null;
  yaw: number | null;
  battery: number | null;
  nav_state: string;
  people: number;
  cpu_percent?: number | null;
  gpu_percent?: number | null;
  memory_percent?: number | null;
  memory_used_gb?: number | null;
  memory_total_gb?: number | null;
  cpu_temp_c?: number | null;
}

/** Robot's answer to a control command. */
export interface Ack {
  ok: boolean;
  msg: string;
}
