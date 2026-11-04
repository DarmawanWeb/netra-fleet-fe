import type {
  Ack,
  Anomaly,
  Branding,
  Feature,
  LicenseInfo,
  LicensePage,
  SetupState,
  ApiClient,
  ApiClientSecret,
  AuditEntry,
  Me,
  Role,
  TrackPoint,
  User,
  FloorPlan,
  GeoSite,
  GeoTransform,
  GeoPoint,
  ControlPoint,
  Basemap,
  HeatCell,
  NetraEvent,
  Patrol,
  PatrolRecap,
  Robot,
  Route,
  RobotCommand,
  Rule,
  Schedule,
  ServerInfo,
  TimelinePoint,
} from './types';

const TOKEN_KEY = 'netra.token';

/**
 * Licensed modules, set by MeProvider from /info before the dashboard renders. Reads of a module
 * that is not licensed answer empty instead of a 403, so a widget that is hidden or shared by several
 * modules never shows an error; the server refuses them anyway.
 */
let licensed: ReadonlySet<Feature> | 'all' = 'all';
export function setLicensedFeatures(features: Feature[] | undefined) {
  licensed = features ? new Set(features) : 'all';
}
export const isLicensed = (f: Feature) => licensed === 'all' || licensed.has(f);
const gated = <T>(f: Feature, empty: T, run: () => Promise<T>): Promise<T> => (isLicensed(f) ? run() : Promise.resolve(empty));

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const session = {
  token: (): string | null => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = session.token();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const res = await fetch(`/api/v1${path}`, { ...init, headers });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth')) {
    session.clear();
    window.location.href = '/login';
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; msg?: string };
    throw new ApiError(res.status, body.error ?? body.msg ?? res.statusText);
  }
  if (res.status === 204 || res.status === 202) {
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  return (await res.json()) as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export interface Range {
  from: Date;
  to: Date;
}

function query(params: Record<string, string | number | undefined | null>, range?: Range): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  if (range) {
    q.set('from', range.from.toISOString());
    q.set('to', range.to.toISOString());
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Authenticated URL for <img> and WebSocket, which cannot send headers. */
export function withToken(path: string): string {
  return `/api/v1${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(session.token() ?? '')}`;
}

/** Authenticated download URL for a report (opened in a new tab). */
function reportUrl(path: string, params: Record<string, string | number | undefined | null>, range?: Range): string {
  return withToken(`/reports/${path}${query(params, range)}`);
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; username: string; role: Role }>('/auth/login', json('POST', { username, password })),
  logout: () => request<void>('/auth/logout', json('POST')),
  me: () => request<Me>('/me'),
  changePassword: (current: string, next: string) => request<void>('/me/password', json('POST', { current, new: next })),
  /** Address robots connect to, the licensed modules and the branding. */
  info: () => request<ServerInfo>('/info'),
  /** Public: the product's name, colours and logo for the login page. */
  branding: async (): Promise<Branding> => {
    const res = await fetch('/api/v1/branding');
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return (await res.json()) as Branding;
  },
  /** First-run setup (public while no user exists); `run` answers like a login. */
  setup: {
    state: () => request<SetupState>('/setup'),
    run: (body: { username: string; display_name: string; password: string; license?: string }) =>
      request<{ token: string; username: string; role: Role; license: LicenseInfo }>('/setup', json('POST', body)),
  },
  license: {
    get: () => request<LicensePage>('/license'),
    /** The license text as uploaded; 400 for a bad signature, 409 when older than the current one. */
    upload: (text: string) => request<LicenseInfo>('/license', json('PUT', { license: text })),
  },
  inspectionModels: () => gated('anomaly', [] as string[], () => request<string[]>('/inspection/models')),

  robots: {
    list: () => request<Robot[]>('/robots'),
    create: (id: string, name: string) => request<{ id: string; token: string }>('/robots', json('POST', { id, name })),
    update: (id: string, name: string, floorPlanId: number | null) =>
      request<void>(`/robots/${id}`, json('PUT', { name, floor_plan_id: floorPlanId })),
    remove: (id: string) => request<void>(`/robots/${id}`, json('DELETE')),
    rotateToken: (id: string) => request<{ id: string; token: string }>(`/robots/${id}/token`, json('POST')),
    /** Waits for the robot's ack (up to 10 s); a refusal throws with the robot's message. */
    inspection: (id: string, args: { enabled?: boolean; model?: string; interval?: number }) =>
      request<Ack>(`/robots/${id}/inspection`, json('POST', args)),
    people: (id: string, enabled: boolean) => request<Ack>(`/robots/${id}/people`, json('POST', { enabled })),
    command: (id: string, name: RobotCommand) => request<{ command_id: string }>(`/robots/${id}/command`, json('POST', { name })),

    track: (id: string, range: Range) => request<TrackPoint[]>(`/robots/${id}/track${query({}, range)}`),
  },

  users: {
    list: () => request<User[]>('/users'),
    create: (u: { username: string; display_name: string; role: Role; password: string }) =>
      request<{ id: number }>('/users', json('POST', u)),
    update: (id: number, u: { display_name: string; role: Role; disabled: boolean }) => request<void>(`/users/${id}`, json('PUT', u)),
    remove: (id: number) => request<void>(`/users/${id}`, json('DELETE')),
    resetPassword: (id: number, password: string) => request<void>(`/users/${id}/password`, json('POST', { password })),
  },

  audit: (range: Range, username?: string) =>
    gated('audit', [] as AuditEntry[], () => request<AuditEntry[]>(`/audit${query({ username }, range)}`)),

  /** Integration API clients (admins). Create and rotateSecret answer the secret once. */
  apiClients: {
    list: () =>
      gated('integration', { clients: [] as ApiClient[], scopes: [] as string[] }, () =>
        request<{ clients: ApiClient[]; scopes: string[] }>('/api-clients'),
      ),
    create: (name: string, scopes: string[]) =>
      request<{ client: ApiClient; client_secret: string }>('/api-clients', json('POST', { name, scopes })),
    update: (id: number, c: { name: string; scopes: string[]; enabled: boolean }) =>
      request<ApiClient>(`/api-clients/${id}`, json('PUT', c)),
    rotateSecret: (id: number) => request<ApiClientSecret>(`/api-clients/${id}/secret`, json('POST')),
    remove: (id: number) => request<void>(`/api-clients/${id}`, json('DELETE')),
  },

  reports: {
    patrolPdf: (id: number, lang: string) => reportUrl(`patrols/${id}/pdf`, { lang }),
    summary: (range: Range, format: 'pdf' | 'xlsx', lang: string, robotId?: string) =>
      reportUrl('summary', { format, lang, robot_id: robotId }, range),
    anomalies: (range: Range, lang: string, robotId?: string) => reportUrl('anomalies', { lang, robot_id: robotId }, range),
    patrols: (range: Range, lang: string, robotId?: string) => reportUrl('patrols', { lang, robot_id: robotId }, range),
  },

  routes: {
    list: (robotId?: string, archived = false) =>
      request<Route[]>(`/routes${query({ robot_id: robotId, archived: archived ? 'true' : undefined })}`),
    get: (id: number) => request<Route>(`/routes/${id}`),
    update: (id: number, name: string, archived: boolean) => request<void>(`/routes/${id}`, json('PUT', { name, archived })),
  },

  schedules: {
    list: () => request<Schedule[]>('/schedules'),
    save: (s: Omit<Schedule, 'id' | 'last_run_on'> & { id?: number }) =>
      s.id ? request<{ id: number }>(`/schedules/${s.id}`, json('PUT', s)) : request<{ id: number }>('/schedules', json('POST', s)),
    remove: (id: number) => request<void>(`/schedules/${id}`, json('DELETE')),
  },

  patrols: {
    list: (range: Range, robotId?: string) => request<Patrol[]>(`/patrols${query({ robot_id: robotId }, range)}`),
    get: (id: number) => request<{ patrol: Patrol; recap: PatrolRecap }>(`/patrols/${id}`),
    start: (robotId: string, routeId: number) =>
      request<{ id: number }>('/patrols', json('POST', { robot_id: robotId, route_id: routeId })),
    stop: (id: number) => request<void>(`/patrols/${id}/stop`, json('POST')),
  },

  events: (robotId?: string, patrolId?: number) => request<NetraEvent[]>(`/events${query({ robot_id: robotId, patrol_id: patrolId })}`),

  anomalies: {
    list: (filter: { status?: string; category?: string; robotId?: string; patrolId?: number }, range: Range) =>
      gated('anomaly', [] as Anomaly[], () =>
        request<Anomaly[]>(
          `/anomalies${query({ status: filter.status, category: filter.category, robot_id: filter.robotId, patrol_id: filter.patrolId }, range)}`,
        ),
      ),
    get: (id: number) => request<Anomaly>(`/anomalies/${id}`),
    validate: (id: number, decision: 'confirm' | 'reject', category?: string, note?: string) =>
      request<void>(`/anomalies/${id}/validate`, json('POST', { decision, category, note })),
    imageUrl: (id: number) => withToken(`/anomalies/${id}/image`),
  },

  rules: {
    list: () => gated('anomaly', [] as Rule[], () => request<Rule[]>('/rules')),
    save: (rule: Rule) => request<void>(`/rules/${encodeURIComponent(rule.category)}`, json('PUT', rule)),
    remove: (category: string) => request<void>(`/rules/${encodeURIComponent(category)}`, json('DELETE')),
  },

  crowd: {
    heatmap: (range: Range, robotId?: string) =>
      gated('crowd', [] as HeatCell[], () => request<HeatCell[]>(`/crowd/heatmap${query({ robot_id: robotId }, range)}`)),
    timeline: (range: Range, bucket: 'hour' | 'day', robotId?: string) =>
      gated('crowd', [] as TimelinePoint[], () =>
        request<TimelinePoint[]>(`/crowd/timeline${query({ robot_id: robotId, bucket }, range)}`),
      ),
  },

  floorPlans: {
    list: () => request<FloorPlan[]>('/floorplans'),
    upload: (file: Blob, filename: string, name: string, width: number, height: number) => {
      const form = new FormData();
      form.set('file', file, filename);
      form.set('name', name);
      form.set('width_px', String(width));
      form.set('height_px', String(height));
      return request<{ id: number }>('/floorplans', { method: 'POST', body: form });
    },
    calibrate: (plan: FloorPlan) => request<void>(`/floorplans/${plan.id}`, json('PUT', plan)),
    remove: (id: number) => request<void>(`/floorplans/${id}`, json('DELETE')),
    fileUrl: (id: number) => withToken(`/floorplans/${id}/file`),
    /** A robot map: map.yaml and its .pgm (or .png); the server renders and places it. */
    uploadRobotMap: (yaml: File, image: File, name: string) => {
      const form = new FormData();
      form.set('yaml', yaml, yaml.name);
      form.set('image', image, image.name);
      form.set('name', name);
      return request<{ id: number; name: string }>('/floorplans/pgm', { method: 'POST', body: form });
    },
  },

  /** The georeference of a GPS deployment. */
  geo: {
    get: () => request<GeoSite>('/geo'),
    save: (body: { points: ControlPoint[]; heading_deg: number | null; basemap: Partial<Basemap> }) =>
      request<GeoSite>('/geo', json('PUT', body)),
    /** The fit of the points without saving it; throws with the reason when it cannot be fitted. */
    fit: (body: { points: ControlPoint[]; heading_deg: number | null }) =>
      request<{ points: GeoPoint[]; transform: GeoTransform }>('/geo/fit', json('POST', body)),
    /** Bounds in degrees; without a file only the bounds and opacity change. */
    overlay: (bounds: { north: number; south: number; east: number; west: number; opacity: number }, file?: File) => {
      const form = new FormData();
      if (file) form.set('image', file, file.name);
      for (const [k, v] of Object.entries(bounds)) form.set(k, String(v));
      return request<GeoSite>('/geo/overlay', { method: 'POST', body: form });
    },
    removeOverlay: () => request<void>('/geo/overlay', json('DELETE')),
    /** The overlay file URL the site answers (/api/v1/geo/overlay/file?v=...) with the token; a local preview (blob:) as is. */
    overlayUrl: (url: string) => (url.startsWith('blob:') ? url : withToken(url.replace(/^\/api\/v1/, ''))),
  },
};
