'use client';

import { useEffect, useState } from 'react';
import { fmtTime } from '@/lib/format';
import { EVENT_LABEL, navState } from '@/lib/labels';
import { useLive } from '@/lib/live';
import type { LiveMessage } from '@/lib/types';

interface FeedItem {
  key: number;
  at: string;
  robot: string;
  text: string;
  tone: 'danger' | 'warn' | 'info';
}

function describe(msg: LiveMessage, label: (c: string) => string): Omit<FeedItem, 'key' | 'at'> | null {
  const robot = 'robot_id' in msg && msg.robot_id ? msg.robot_id : '';
  switch (msg.type) {
    case 'alert':
      return { robot, text: navState(String(msg.data.state)).label, tone: 'danger' };
    case 'stop_event':
      return { robot, text: `${EVENT_LABEL[String(msg.data.event)] ?? msg.data.event} #${Number(msg.data.index) + 1}`, tone: 'info' };
    case 'patrol_event':
      return { robot, text: EVENT_LABEL[String(msg.data.event)] ?? String(msg.data.event), tone: 'info' };
    case 'anomaly':
      return msg.status === 'queued' || msg.status === 'needs_validation'
        ? { robot, text: `Anomali ${msg.category ? label(msg.category) : 'baru'}${msg.status === 'needs_validation' ? ' — perlu validasi' : ''}`, tone: 'warn' }
        : null;
    case 'robot_online':
      return { robot, text: msg.online ? 'Terhubung' : 'Terputus', tone: msg.online ? 'info' : 'danger' };
    default:
      return null;
  }
}

const toneClass = { danger: 'border-danger text-danger', warn: 'border-warn text-warn', info: 'border-accent text-slate-300' };

export function EventFeed({ label }: { label: (c: string) => string }) {
  const { subscribe } = useLive();
  const [items, setItems] = useState<FeedItem[]>([]);
  useEffect(
    () =>
      subscribe((msg) => {
        const d = describe(msg, label);
        if (d) setItems((list) => [{ ...d, key: Date.now() + Math.random(), at: new Date().toISOString() }, ...list].slice(0, 40));
      }),
    [subscribe, label],
  );
  if (!items.length) return <div className="py-6 text-center text-xs text-slate-500">Menunggu kejadian…</div>;
  return (
    <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
      {items.map((i) => (
        <li key={i.key} className={`border-l-2 pl-2 text-xs ${toneClass[i.tone]}`}>
          <span className="font-mono text-slate-500">{fmtTime(i.at)}</span> <b className="text-slate-200">{i.robot}</b> {i.text}
        </li>
      ))}
    </ul>
  );
}
