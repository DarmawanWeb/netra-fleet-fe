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

/** GPS position a robot may send in its telemetry (WGS84 degrees). */
export interface GpsFix {
  lat: number;
  lon: number;
  /** none, gps, dgps, rtk_float, rtk_fixed; none means no position. */
  fix?: string;
  hdop?: number;
}

export interface Telemetry {
  type: 'telemetry';
  ts: number;
  pose: Pose | null;
  /** Robots with a GNSS receiver; on GPS maps it places the robot when present. */
  gps?: GpsFix | null;
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

/** Feature modules a license can grant (netra-fleet-be internal/license). The core needs none. */
export type Feature =
  | 'anomaly'
  | 'crowd'
  | 'substation'
  | 'reports.export'
  | 'alerts.telegram'
  | 'audit'
  | 'ai.final'
  | 'integration'
  | 'multisite';

export type LicenseStatus = 'missing' | 'invalid' | 'valid' | 'grace' | 'expired';

/** The kind of map a deployment draws on, fixed by its license. */
export type MapMode = 'floorplan' | 'pgm' | 'gps';

export interface LicenseInfo {
  status: LicenseStatus;
  id?: string;
  client?: string;
  edition?: string;
  tier?: string;
  /** Modules in force: empty unless the status is valid or grace. */
  features: Feature[];
  map: MapMode;
  max_robots: number;
  /** The installation the license is bound to; absent when it works on any server. */
  installation?: string;
  issued_at?: string;
  expires_at?: string;
  grace_ends?: string;
  source?: 'file' | 'env' | 'upload';
  error?: string;
}

export interface Branding {
  name: string;
  color?: string;
  color_dark?: string;
  /** URL of the client's logo; absent for the default. */
  logo?: string;
}

export interface ServerInfo {
  public_url: string;
  time_zone: string;
  version?: string;
  /** This server's installation ID; licenses can be bound to it. */
  installation_id?: string;
  /** Absent on servers from before map modes, which use floor plans. */
  map_mode?: MapMode;
  edition?: string;
  tier?: string;
  /** Absent on servers from before licensing, which have every module. */
  features?: Feature[];
  /** 0: no limit. */
  robot_limit?: number;
  license?: LicenseInfo;
  branding?: Branding;
}

export interface LicensePage {
  installation_id: string;
  map_modes: MapMode[];
  license: LicenseInfo;
  catalog: { ID: Feature; Description: string }[];
  editions: Record<string, Feature[]>;
  tiers: Record<string, Feature[]>;
  robots: number;
  robot_limit: number;
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
  /** With the substation module: how much of the route's inspection plan the patrol did. */
  inspections?: InspectionCoverage;
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

/** floorplan: an uploaded layout calibrated by hand; pgm: a robot map placed by its map.yaml. */
export type PlanKind = 'floorplan' | 'pgm';

export interface FloorPlan {
  id: number;
  name: string;
  /** Absent on servers from before map modes (floor plans). */
  kind?: PlanKind;
  content_type: string;
  width_px: number;
  height_px: number;
  origin_x_px: number;
  origin_y_px: number;
  px_per_m: number;
  rotation_rad: number;
  created_at: string;
  /** Robot maps: metres per pixel and [x, y, yaw] of the lower-left pixel, from map.yaml. */
  resolution?: number | null;
  origin?: [number, number, number] | null;
}

/** A place known in the robot map frame (metres) and on the earth (WGS84 degrees). */
export interface ControlPoint {
  label: string;
  x: number;
  y: number;
  lat: number;
  lon: number;
}

/** Map frame to WGS84: a similarity into the tangent plane at (ref_lat, ref_lon), then onto the ellipsoid. */
export interface GeoTransform {
  ref_lat: number;
  ref_lon: number;
  scale: number;
  rotation_rad: number;
  east_m: number;
  north_m: number;
  method: 'points' | 'heading';
  rms_m: number;
  /** Compass heading of the map x axis. */
  heading_deg: number;
}

export type BasemapKind = 'osm' | 'satellite' | 'custom' | 'none';

export interface Basemap {
  kind: BasemapKind;
  url: string;
  attribution: string;
  max_zoom: number;
}

/** An image of the site (north up) over its bounds. */
export interface GeoOverlay {
  url: string;
  content_type: string;
  north: number;
  south: number;
  east: number;
  west: number;
  opacity: number;
  updated_at: string;
}

export interface GeoPoint extends ControlPoint {
  /** Ground distance to where the transform puts the point; null without a fit. */
  residual_m: number | null;
}

/** GET /geo: the georeference of a GPS deployment. */
export interface GeoSite {
  points: GeoPoint[];
  heading_deg: number | null;
  transform: GeoTransform | null;
  basemap: Basemap;
  overlay: GeoOverlay | null;
  presets: Basemap[];
  updated_by: string;
  updated_at: string | null;
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
  | { type: 'route'; robot_id: string; id: number }
  | { type: 'license'; license: LicenseInfo }
  | { type: 'geo' }
  | { type: 'inspection'; id: number; point_id: number; robot_id: string; priority: Priority; kind: PointKind }
  | {
      type: 'finding';
      id: number;
      event: FindingEvent;
      status: FindingStatus;
      priority: Priority;
      last_priority?: Priority;
      point_id: number;
      asset_id: number | null;
    };

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
  /** GPS position of the sample, when the robot reported a fix. */
  lat?: number | null;
  lon?: number | null;
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

/** GET /api/v1/setup: whether this is a new installation waiting for its first administrator. */
export interface SetupState {
  required: boolean;
  installation_id: string;
  version: string;
  license: LicenseInfo;
}

/** A database backup of the installation (System page). */
export interface BackupInfo {
  name: string;
  size: number;
  created: string;
}

/** GET /api/v1/system: how the installation runs (administrators). */
export interface SystemStatus {
  version: string;
  installation_id: string;
  started_at: string;
  uptime_s: number;
  time_zone: string;
  tls: boolean;
  database: { size_bytes: number; managed: boolean };
  disk: {
    path: string;
    data_bytes: number;
    data_files: number;
    data_complete: boolean;
    free_bytes?: number;
    total_bytes?: number;
  };
  backups: { enabled: boolean; keep_days?: number; at?: string; dir?: string; list: BackupInfo[] };
  robots: { registered: number; online: number };
  license: LicenseInfo;
  map_mode: MapMode;
}

// ---- substation inspection (module `substation`)

/** NETA thermographic priority: 1 repair immediately … 4 warrants investigation; 0 normal. */
export type Priority = 0 | 1 | 2 | 3 | 4;
export type PointKind = 'thermal' | 'pd';
export type Reference = 'auto' | 'similar' | 'ambient' | 'both';
export type Basis = 'similar' | 'ambient' | 'limit' | 'pd' | '';
export type FindingStatus = 'open' | 'acknowledged' | 'resolved';
export type FindingEvent = 'opened' | 'seen' | 'escalated' | 'normal' | 'acknowledged' | 'resolved' | 'notified';

export interface Asset {
  id: number;
  tag: string;
  name: string;
  kind: string;
  bay: string;
  voltage_kv: number | null;
  phase: string;
  x: number | null;
  y: number | null;
  notes: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  /** The most severe priority of its findings not resolved; null when none. */
  priority: Priority | null;
  open_findings: number;
  last_inspected: string | null;
}

export type AssetInput = Pick<Asset, 'tag' | 'name' | 'kind' | 'bay' | 'voltage_kv' | 'phase' | 'x' | 'y' | 'notes' | 'archived'>;

export interface PTZ {
  pan_deg: number;
  tilt_deg: number;
  zoom: number;
}

/** A region of the thermal image as fractions of its width and height, from the top left. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Target {
  key: string;
  label: string;
  asset_id: number | null;
  phase: string;
  group: string;
  roi: Region | null;
  limit_c: number | null;
}

export interface PointSettings {
  reference?: Reference;
  emissivity?: number;
  distance_m?: number;
  watch_db?: number;
  alarm_db?: number;
}

export interface InspectionPoint {
  id: number;
  name: string;
  kind: PointKind;
  asset_id: number | null;
  route_id: number | null;
  stop_index: number | null;
  seq: number;
  ptz: PTZ | null;
  settings: PointSettings;
  targets: Target[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_inspected: string | null;
  priority: Priority | null;
  /** The robot of its route and where it stands at the stop (map metres, degrees). */
  robot_id?: string;
  stance: { x: number; y: number; yaw_deg: number } | null;
}

export type PointInput = Pick<
  InspectionPoint,
  'name' | 'kind' | 'asset_id' | 'route_id' | 'stop_index' | 'seq' | 'ptz' | 'settings' | 'targets' | 'enabled'
>;

export interface ThermalResult {
  key: string;
  max_c: number;
  avg_c?: number;
  min_c?: number;
  label: string;
  asset_id: number | null;
  ref_key?: string;
  delta_similar_c: number | null;
  delta_ambient_c: number | null;
  priority: Priority;
  basis?: Basis;
}

export interface PDResult {
  db: number;
  detected: boolean;
  kind?: string;
  priority: Priority;
}

export type InspectionImage = 'thermal' | 'visual' | 'acoustic';

export interface Inspection {
  id: number;
  uid: string;
  point_id: number;
  point_name: string;
  robot_id: string | null;
  patrol_id: number | null;
  taken_at: string;
  kind: PointKind;
  reference?: Reference;
  ambient_c: number | null;
  thermal?: ThermalResult[];
  pd?: PDResult;
  priority: Priority;
  x: number | null;
  y: number | null;
  yaw: number | null;
  images: InspectionImage[];
  created_at: string;
}

export interface Finding {
  id: number;
  point_id: number;
  point_name: string;
  target_key: string;
  label: string;
  asset_id: number | null;
  asset_tag: string | null;
  asset_name: string | null;
  kind: PointKind;
  status: FindingStatus;
  priority: Exclude<Priority, 0>;
  basis: Basis;
  last_priority: Priority;
  first_inspection_id: number;
  last_inspection_id: number;
  first_seen: string;
  last_seen: string;
  last_value: number | null;
  last_delta_c: number | null;
  occurrences: number;
  note: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubstationSummary {
  assets: number;
  points: number;
  /** Findings not resolved by priority "1" … "4". */
  findings: Record<string, number>;
  unacknowledged: number;
  /** Assets by their most severe open priority, "ok" for none. */
  assets_by_condition: Record<string, number>;
  inspections_24h: number;
  last_inspection: string | null;
}

export interface SubstationSettings {
  finding_priority: number;
  alert_priority: number;
  pd: { watch_db: number; alarm_db: number };
  telegram_chat_id: string;
}

export interface Criteria {
  thermal: { priority: Exclude<Priority, 0>; similar: string; ambient: string; action: string }[];
  asset_kinds: string[];
  point_kinds: PointKind[];
  references: Reference[];
}

export interface Trend {
  point_id: number;
  kind: PointKind;
  series: { key: string; label: string }[];
  samples: { inspection_id: number; taken_at: string; ambient_c: number | null; priority: Priority; values: Record<string, number> }[];
  from: string;
  to: string;
}

export interface InspectionCoverage {
  planned: number;
  done: number;
  inspections: number;
  priority: Priority;
  missed: number[];
}
