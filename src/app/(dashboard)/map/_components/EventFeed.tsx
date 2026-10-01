'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/format';
import { useLive } from '@/lib/live';
import type { LiveMessage } from '@/lib/types';

interface FeedItem {
  key: number;
  at: string;
  robot: string;
  text: string;
  tone: 'danger' | 'warn' | 'info';
}

const toneClass = { danger: 'border-danger text-danger', warn: 'border-warn text-warn', info: 'border-accent text-slate-300' };

export function EventFeed({ label }: { label: (c: string) => string }) {
  const { subscribe } = useLive();
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    const describe = (msg: LiveMessage): Omit<FeedItem, 'key' | 'at'> | null => {
      const robot = 'robot_id' in msg && msg.robot_id ? msg.robot_id : '';
      switch (msg.type) {
        case 'alert':
          return { robot, text: tx('navState', String(msg.data.state)), tone: 'danger' };
        case 'stop_event':
          return { robot, text: `${tx('event', String(msg.data.event))} #${Number(msg.data.index) + 1}`, tone: 'info' };
        case 'patrol_event':
          return { robot, text: tx('event', String(msg.data.event)), tone: 'info' };
        case 'anomaly':
          if (msg.status === 'queued')
            return { robot, text: t('event.newAnomaly', { category: msg.category ? label(msg.category) : '' }), tone: 'warn' };
          if (msg.status === 'needs_validation')
            return { robot, text: t('event.needsValidation', { category: label(msg.category ?? '') }), tone: 'warn' };
          return null;
        case 'robot_online':
          return { robot, text: msg.online ? t('event.connected') : t('event.disconnected'), tone: msg.online ? 'info' : 'danger' };
        default:
          return null;
      }
    };
    return subscribe((msg) => {
      const d = describe(msg);
      if (d) setItems((list) => [{ ...d, key: Date.now() + Math.random(), at: new Date().toISOString() }, ...list].slice(0, 50));
    });
  }, [subscribe, label, t, tx]);

  if (!items.length) return <div className="py-6 text-center text-xs text-slate-500">{t('map.waiting')}</div>;
  return (
    <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
      {items.map((i) => (
        <li key={i.key} className={`border-l-2 pl-2 text-xs ${toneClass[i.tone]}`}>
          <span className="font-mono text-slate-500">{fmt.timeSec(i.at)}</span> <b className="text-slate-200">{i.robot}</b> {i.text}
        </li>
      ))}
    </ul>
  );
}
