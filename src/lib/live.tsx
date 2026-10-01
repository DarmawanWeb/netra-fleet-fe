'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { session } from './api';
import type { LiveMessage, Telemetry } from './types';

type Listener = (msg: LiveMessage) => void;

interface LiveState {
  connected: boolean;
  telemetry: Record<string, Telemetry>;
  online: Record<string, boolean>;
  /** Increments on every anomaly/route/patrol change so pages can refetch. */
  revision: number;
  subscribe: (fn: Listener) => () => void;
}

const LiveContext = createContext<LiveState | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState<Record<string, Telemetry>>({});
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [revision, setRevision] = useState(0);
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${window.location.host}/api/v1/ws?token=${encodeURIComponent(session.token() ?? '')}`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 3000);
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data)) as LiveMessage;
        if (msg.type === 'telemetry') {
          setTelemetry((t) => ({ ...t, [msg.robot_id]: msg.data }));
          setOnline((o) => (o[msg.robot_id] ? o : { ...o, [msg.robot_id]: true }));
        } else if (msg.type === 'robot_online') {
          setOnline((o) => ({ ...o, [msg.robot_id]: msg.online }));
        } else if (['anomaly', 'route', 'patrol_event', 'patrol_requested', 'ack'].includes(msg.type)) {
          setRevision((r) => r + 1);
        }
        listeners.current.forEach((fn) => fn(msg));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const value = useMemo(() => ({ connected, telemetry, online, revision, subscribe }), [connected, telemetry, online, revision, subscribe]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveState {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive outside LiveProvider');
  return ctx;
}
