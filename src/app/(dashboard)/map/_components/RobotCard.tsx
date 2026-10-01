'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { navTone } from '@/lib/labels';
import { useMe } from '@/lib/session';
import type { Robot, Telemetry } from '@/lib/types';

type Command = 'pause' | 'resume' | 'localize' | 'stop_patrol';

export function RobotCard({
  robot,
  telemetry,
  online,
  selected,
  onSelect,
}: {
  robot: Robot;
  telemetry: Telemetry | null;
  online: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const { can } = useMe();
  const [busy, setBusy] = useState<Command | null>(null);
  const [note, setNote] = useState<string>();
  const battery = telemetry?.battery?.pct ?? null;
  const health = telemetry?.health;
  const send = async (name: Command) => {
    setBusy(name);
    setNote(undefined);
    try {
      await api.robots.command(robot.id, name);
      setNote(t('robot.commandSent'));
    } catch (e) {
      setNote(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div
      onClick={onSelect}
      className={cx(
        'cursor-pointer rounded-lg border p-3 transition',
        selected ? 'border-accent bg-accent/5' : 'border-ink-600 bg-ink-800/50 hover:border-ink-500',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cx('h-2 w-2 rounded-full', online ? 'bg-ok' : 'bg-slate-600')} />
          <span className="font-medium text-slate-100">{robot.name}</span>
        </div>
        <Badge tone={online ? navTone(telemetry?.nav.state) : 'muted'}>{online ? tx('navState', telemetry?.nav.state) : 'Offline'}</Badge>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
        <div>
          <div className="text-slate-500">{t('robot.battery')}</div>
          <div className={cx('font-mono', battery !== null && battery < 25 ? 'text-danger' : 'text-slate-200')}>
            {battery === null ? '—' : `${battery}%`}
          </div>
        </div>
        <div>
          <div className="text-slate-500">{t('robot.mode')}</div>
          <div className="text-slate-200">{telemetry?.mode === 'remote' ? t('robot.remote') : t('robot.auto')}</div>
        </div>
        <div>
          <div className="text-slate-500">{t('robot.people')}</div>
          <div className="font-mono text-slate-200">{telemetry?.people ?? 0}</div>
        </div>
        <div>
          <div className="text-slate-500">{t('robot.health')}</div>
          <div className={cx(health && !health.ok ? 'text-warn' : 'text-slate-200')} title={health?.issues.join('\n')}>
            {health ? (health.ok ? t('robot.healthy') : t('robot.issues', { n: health.issues.length })) : '—'}
          </div>
        </div>
      </div>
      <div className="mt-2 truncate text-xs text-slate-400">
        {online ? telemetry?.mission || telemetry?.nav.message || '—' : t('robot.lastSeen', { ago: fmt.ago(robot.last_seen) })}
      </div>
      {selected && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {online && can('operate') && (
            <>
              {telemetry?.nav.state === 'PAUSED' ? (
                <Button disabled={!!busy} onClick={() => send('resume')}>
                  {t('robot.resume')}
                </Button>
              ) : (
                <Button disabled={!!busy} onClick={() => send('pause')}>
                  {t('robot.pause')}
                </Button>
              )}
              <Button disabled={!!busy} onClick={() => send('localize')}>
                {t('robot.localize')}
              </Button>
              <Button
                variant="danger"
                disabled={!!busy}
                onClick={() => confirm(t('robot.confirmStop', { name: robot.name })) && send('stop_patrol')}
              >
                {t('robot.stopPatrol')}
              </Button>
            </>
          )}
          <Link href={`/robots/${robot.id}`} className="ml-auto text-xs text-accent">
            {t('robot.details')} →
          </Link>
          {note && <span className="w-full text-xs text-slate-400">{note}</span>}
        </div>
      )}
    </div>
  );
}
