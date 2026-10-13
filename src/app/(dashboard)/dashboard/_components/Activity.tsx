'use client';

import { useEffect, useMemo, useState } from 'react';
import { cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/format';
import { useLive } from '@/lib/live';
import type { Anomaly, LiveMessage, NetraEvent, Robot, RoutePoint } from '@/lib/types';
import { stopNumber } from '../_lib/stops';

type Tone = 'danger' | 'warn' | 'info';
interface Item {
  key: string;
  at: string;
  robotId: string;
  text: string;
  tone: Tone;
}

const TONE_BAR: Record<Tone, string> = { danger: 'bg-danger', warn: 'bg-warn', info: 'bg-accent/60' };
const LIMIT = 60;

/** Robot events (stored and live) and today's detections, newest first. */
export function Activity({
  events,
  anomalies,
  robots,
  routePoints,
  label,
}: {
  events: NetraEvent[];
  anomalies: Anomaly[];
  robots: Robot[];
  routePoints: Record<number, RoutePoint[]>;
  label: (c: string) => string;
}) {
  const { subscribe } = useLive();
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const [live, setLive] = useState<Item[]>([]);

  const describe = useMemo(() => {
    return (type: string, data: Record<string, unknown>): { text: string; tone: Tone } | null => {
      switch (type) {
        case 'alert':
          return { text: tx('navState', String(data.state)), tone: 'danger' };
        case 'stop_event': {
          const ev = String(data.event);
          if (ev === 'departed') return null; // arrived + inspected tell the story
          const points = routePoints[Number(data.route_id)];
          return { text: `${tx('event', ev)} ${stopNumber(points, Number(data.index))}`, tone: ev === 'skipped' ? 'warn' : 'info' };
        }
        case 'patrol_event':
          return { text: tx('event', String(data.event)) + (data.lap ? ` ${data.lap}` : ''), tone: 'info' };
        default:
          return null;
      }
    };
  }, [tx, routePoints]);

  useEffect(
    () =>
      subscribe((msg: LiveMessage) => {
        let d: { text: string; tone: Tone } | null = null;
        if (msg.type === 'alert' || msg.type === 'stop_event' || msg.type === 'patrol_event') d = describe(msg.type, msg.data);
        else if (msg.type === 'robot_online')
          d = { text: msg.online ? t('event.connected') : t('event.disconnected'), tone: msg.online ? 'info' : 'danger' };
        else if (msg.type === 'anomaly' && msg.status === 'queued')
          d = { text: t('dashboard.anomalyDetected', { category: msg.category ? label(msg.category) : '' }), tone: 'warn' };
        if (!d) return;
        const key = msg.type === 'anomaly' ? `a${msg.id}` : `live-${Date.now()}-${Math.random()}`;
        const item = { ...d, key, at: new Date().toISOString(), robotId: 'robot_id' in msg ? (msg.robot_id ?? '') : '' };
        setLive((list) => [item, ...list].slice(0, LIMIT));
      }),
    [subscribe, describe, label, t],
  );

  const items = useMemo(() => {
    // Live items cover what happened since the page loaded; stored events from before that.
    const since = live.length ? live[live.length - 1]!.at : null;
    const liveKeys = new Set(live.map((i) => i.key));
    const history: Item[] = [];
    for (const e of events) {
      const d = describe(e.type, e.payload);
      if (d && (!since || e.ts < since)) history.push({ ...d, key: `e${e.id}`, at: e.ts, robotId: e.robot_id });
    }
    for (const a of anomalies) {
      if (liveKeys.has(`a${a.id}`)) continue;
      history.push({
        key: `a${a.id}`,
        at: a.detected_at,
        robotId: a.robot_id,
        text: t('dashboard.anomalyDetected', { category: label(a.final_category ?? a.early_category) }),
        tone: 'warn',
      });
    }
    return [...live, ...history].sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT);
  }, [events, anomalies, live, describe, label, t]);

  const name = (id: string) => robots.find((r) => r.id === id)?.name ?? id;
  const several = new Set(items.map((i) => i.robotId)).size > 1;
  return (
    <section className="flex min-h-0 flex-col" aria-labelledby="activity-title">
      <header className="px-4 pb-1.5 pt-3">
        <h2 id="activity-title" className="text-[13px] font-semibold text-slate-200">
          {t('dashboard.activity')}
        </h2>
      </header>
      {items.length ? (
        <ol className="min-h-0 flex-1 overflow-y-auto px-4 pb-3" aria-live="polite">
          {items.map((i) => (
            <li key={i.key} className="flex gap-2.5 py-1 text-xs">
              <span className={cx('mt-1 h-3 w-0.5 shrink-0 rounded-full', TONE_BAR[i.tone])} aria-hidden />
              <span className="w-12 shrink-0 tabular-nums text-slate-500">{fmt.time(i.at)}</span>
              <span className="min-w-0 text-slate-300">
                {several && <span className="text-slate-100">{name(i.robotId)} </span>}
                {i.text}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 pb-3 text-xs text-slate-500">{t('dashboard.noActivity')}</p>
      )}
    </section>
  );
}
