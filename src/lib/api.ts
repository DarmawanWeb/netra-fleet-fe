import type {
  Anomaly,
  FloorPlan,
  HeatCell,
  NetraEvent,
  Patrol,
  PatrolRecap,
  Robot,
  Route,
  Rule,
  Schedule,
  TimelinePoint,
} from './types';

const TOKEN_KEY = 'netra.token';

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
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
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

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; username: string }>('/auth/login', json('POST', { username, password })),
  me: () => request<{ username: string; timezone: string }>('/me'),

  robots: {
    list: () => request<Robot[]>('/robots'),
    create: (id: string, name: string) => request<{ id: string; token: string }>('/robots', json('POST', { id, name })),
    update: (id: string, name: string, floorPlanId: number | null) =>
      request<void>(`/robots/${id}`, json('PUT', { name, floor_plan_id: floorPlanId })),
    remove: (id: string) => request<void>(`/robots/${id}`, json('DELETE')),
    rotateToken: (id: string) => request<{ id: string; token: string }>(`/robots/${id}/token`, json('POST')),
    command: (id: string, name: 'pause' | 'resume' | 'localize' | 'stop_patrol') =>
      request<{ command_id: string }>(`/robots/${id}/command`, json('POST', { name })),
  },

  routes: {
    list: (robotId?: string, archived = false) =>
      request<Route[]>(`/routes${query({ robot_id: robotId, archived: archived ? 'true' : undefined })}`),
    get: (id: number) => request<Route>(`/routes/${id}`),
    update: (id: number, name: string, archived: boolean) =>
      request<void>(`/routes/${id}`, json('PUT', { name, archived })),
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

  events: (robotId?: string, patrolId?: number) =>
    request<NetraEvent[]>(`/events${query({ robot_id: robotId, patrol_id: patrolId })}`),

  anomalies: {
    list: (filter: { status?: string; category?: string; robotId?: string; patrolId?: number }, range: Range) =>
      request<Anomaly[]>(
        `/anomalies${query({ status: filter.status, category: filter.category, robot_id: filter.robotId, patrol_id: filter.patrolId }, range)}`,
      ),
    get: (id: number) => request<Anomaly>(`/anomalies/${id}`),
    validate: (id: number, decision: 'confirm' | 'reject', category?: string, note?: string) =>
      request<void>(`/anomalies/${id}/validate`, json('POST', { decision, category, note })),
    imageUrl: (id: number) => withToken(`/anomalies/${id}/image`),
  },

  rules: {
    list: () => request<Rule[]>('/rules'),
    save: (rule: Rule) => request<void>(`/rules/${encodeURIComponent(rule.category)}`, json('PUT', rule)),
    remove: (category: string) => request<void>(`/rules/${encodeURIComponent(category)}`, json('DELETE')),
  },

  crowd: {
    heatmap: (range: Range, robotId?: string) => request<HeatCell[]>(`/crowd/heatmap${query({ robot_id: robotId }, range)}`),
    timeline: (range: Range, bucket: 'hour' | 'day', robotId?: string) =>
      request<TimelinePoint[]>(`/crowd/timeline${query({ robot_id: robotId, bucket }, range)}`),
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
  },
};
