'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { useLive } from '@/lib/live';
import type { Anomaly, Pose, RoutePoint, Telemetry } from '@/lib/types';

const DAY_MS = 864e5;
// One shared empty list, so components that depend on the data do not see a new array every render.
const EMPTY: never[] = [];

const startOfToday = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/** Changes at midnight (checked every minute) so "today" queries roll over on a wall display. */
function useDayKey(): string {
  const [key, setKey] = useState(() => startOfToday().toDateString());
  useEffect(() => {
    const timer = setInterval(() => setKey(startOfToday().toDateString()), 60e3);
    return () => clearInterval(timer);
  }, []);
  return key;
}

/** Everything the dashboard shows; refetched when the live socket reports a change. */
export function useOverview() {
  const { revision, subscribe } = useLive();
  const day = useDayKey();
  const [crowdTick, setCrowdTick] = useState(0);

  // Crowd windows arrive about once a minute per robot; refresh the hourly peaks at most every 30 s.
  useEffect(() => {
    let last = 0;
    return subscribe((msg) => {
      if (msg.type === 'crowd' && Date.now() - last > 30e3) {
        last = Date.now();
        setCrowdTick((n) => n + 1);
      }
    });
  }, [subscribe]);

  const today = () => ({ from: startOfToday(), to: new Date(Date.now() + 60e3) });
  const robots = useAsync(() => api.robots.list(), [revision]);
  const plans = useAsync(() => api.floorPlans.list(), []);
  const routes = useAsync(() => api.routes.list(), [revision]);
  const patrols = useAsync(() => api.patrols.list(today()), [revision, day]);
  const anomaliesToday = useAsync(() => api.anomalies.list({}, today()), [revision, day]);
  const anomalies24h = useAsync(() => api.anomalies.list({}, { from: new Date(Date.now() - DAY_MS), to: new Date() }), [revision]);
  // Waiting items stay in the queue whatever day they came in (bounded to a month).
  const pending = useAsync(
    () => api.anomalies.list({ status: 'needs_validation' }, { from: new Date(Date.now() - 30 * DAY_MS), to: new Date() }),
    [revision],
  );
  const crowd = useAsync(() => api.crowd.timeline(today(), 'hour'), [crowdTick, day]);
  const events = useAsync(() => api.events(), [day]);
  const info = useAsync(() => api.info().catch(() => null), []);

  return {
    robots: robots.data ?? EMPTY,
    plans: plans.data,
    routes: routes.data ?? EMPTY,
    patrols: patrols.data ?? EMPTY,
    anomaliesToday: anomaliesToday.data ?? EMPTY,
    anomalies24h: anomalies24h.data ?? EMPTY,
    pending: pending.data ?? EMPTY,
    crowd: crowd.data ?? EMPTY,
    events: events.data ?? EMPTY,
    publicUrl: info.data?.public_url ?? '',
    error: robots.error ?? plans.error ?? patrols.error,
    loaded: !!robots.data && !!plans.data,
    reloadPending: () => (pending.reload(), anomaliesToday.reload(), anomalies24h.reload()),
  };
}

const TRAIL_POINTS = 150; // about 2.5 minutes at the 1 Hz telemetry rate
const TRAIL_METRES = 80; // and never longer than this, so a fast robot does not paint its whole route

/** The newest part of a trail: at most TRAIL_POINTS poses and TRAIL_METRES of path. */
function clip(poses: Pose[]): Pose[] {
  const list = poses.slice(-TRAIL_POINTS);
  let length = 0;
  for (let i = list.length - 1; i > 0; i--) {
    length += Math.hypot(list[i]!.x - list[i - 1]!.x, list[i]!.y - list[i - 1]!.y);
    if (length > TRAIL_METRES) return list.slice(i);
  }
  return list;
}

/** Recent positions per robot: the last minutes of the telemetry history, then live updates. */
export function useTrails(robotIds: string[]): Record<string, Pose[]> {
  const { subscribe } = useLive();
  const [trails, setTrails] = useState<Record<string, Pose[]>>({});
  const loaded = useRef(new Set<string>());
  const key = robotIds.join(',');

  useEffect(() => {
    for (const id of key ? key.split(',') : []) {
      if (loaded.current.has(id)) continue;
      loaded.current.add(id);
      api.robots
        .track(id, { from: new Date(Date.now() - 5 * 60e3), to: new Date() })
        .then((points) => {
          // The track is in time order, sampled every 5 s; live poses that already arrived go after it.
          const history = points.filter((p) => p.x !== null && p.y !== null).map((p) => ({ x: p.x!, y: p.y!, yaw: p.yaw ?? 0 }));
          setTrails((t) => ({ ...t, [id]: clip([...history, ...(t[id] ?? [])]) }));
        })
        .catch(() => undefined);
    }
  }, [key]);

  useEffect(
    () =>
      subscribe((msg) => {
        if (msg.type !== 'telemetry' || !msg.data.pose) return;
        const pose = msg.data.pose;
        setTrails((t) => {
          const list = t[msg.robot_id] ?? [];
          const last = list[list.length - 1];
          if (last && Math.hypot(last.x - pose.x, last.y - pose.y) < 0.05) return t;
          return { ...t, [msg.robot_id]: clip([...list, pose]) };
        });
      }),
    [subscribe],
  );
  return trails;
}

export interface Progress {
  /** Route waypoint index of the last stop reached, from stop events. */
  stopIndex: number | null;
}

/** Last stop reached by each running patrol: its stored events, then live stop events. */
export function usePatrolProgress(telemetry: Record<string, Telemetry>): Record<number, Progress> {
  const { subscribe } = useLive();
  const [progress, setProgress] = useState<Record<number, Progress>>({});
  const fetched = useRef(new Set<number>());
  const active = useMemo(
    () => [
      ...new Set(
        Object.values(telemetry)
          .map((t) => t.patrol?.patrol_id)
          .filter((id): id is number => !!id),
      ),
    ],
    [telemetry],
  );

  useEffect(() => {
    for (const id of active) {
      if (fetched.current.has(id)) continue;
      fetched.current.add(id);
      api
        .events(undefined, id)
        .then((events) => {
          const stop = events.find((e) => e.type === 'stop_event' && typeof e.payload.index === 'number');
          if (stop) setProgress((p) => (p[id] ? p : { ...p, [id]: { stopIndex: Number(stop.payload.index) } }));
        })
        .catch(() => undefined);
    }
  }, [active]);

  useEffect(
    () =>
      subscribe((msg) => {
        if (msg.type !== 'stop_event') return;
        const id = Number(msg.data.patrol_id);
        if (id > 0 && typeof msg.data.index === 'number') setProgress((p) => ({ ...p, [id]: { stopIndex: Number(msg.data.index) } }));
      }),
    [subscribe],
  );
  return progress;
}

/** Points of the given routes (fetched once each): route lines on the map and stop numbers. */
export function useRoutePoints(ids: (number | null | undefined)[]): Record<number, RoutePoint[]> {
  const [points, setPoints] = useState<Record<number, RoutePoint[]>>({});
  const requested = useRef(new Set<number>());
  const key = [...new Set(ids.filter((id): id is number => typeof id === 'number' && id > 0))].sort((a, b) => a - b).join(',');
  useEffect(() => {
    for (const id of key ? key.split(',').map(Number) : []) {
      if (requested.current.has(id)) continue;
      requested.current.add(id);
      api.routes
        .get(id)
        .then((r) => setPoints((m) => ({ ...m, [id]: r.points ?? [] })))
        .catch(() => requested.current.delete(id));
    }
  }, [key]);
  return points;
}

/** Anomaly ids that arrived on the live socket in the last `ms` milliseconds (map ripple). */
export function useFreshAnomalies(ms = 15e3): Set<number> {
  const { subscribe } = useLive();
  const [fresh, setFresh] = useState<Record<number, number>>({});
  useEffect(
    () =>
      subscribe((msg) => {
        if (msg.type === 'anomaly' && msg.status === 'queued') setFresh((f) => ({ ...f, [msg.id]: Date.now() }));
      }),
    [subscribe],
  );
  useEffect(() => {
    if (!Object.keys(fresh).length) return;
    const timer = setInterval(() => {
      setFresh((f) => Object.fromEntries(Object.entries(f).filter(([, at]) => Date.now() - at < ms)));
    }, 1000);
    return () => clearInterval(timer);
  }, [fresh, ms]);
  return useMemo(() => new Set(Object.keys(fresh).map(Number)), [fresh]);
}

/** Anomalies that count as findings (not dismissed as false positives). */
export const isFinding = (a: Anomaly) => !['rejected', 'dismissed'].includes(a.status);
