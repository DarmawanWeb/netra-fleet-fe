'use client';

import { useState } from 'react';
import { Badge, Button, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { navState } from '@/lib/labels';
import type { Robot, Telemetry } from '@/lib/types';

type Command = 'pause' | 'resume' | 'localize' | 'stop_patrol';

export function RobotCard({ robot, telemetry, online, selected, onSelect }: {
  robot: Robot;
  telemetry: Telemetry | null;
  online: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const [busy, setBusy] = useState<Command | null>(null);
  const [note, setNote] = useState<string>();
  const nav = navState(telemetry?.nav.state);
  const battery = telemetry?.battery?.pct ?? null;
  const send = async (name: Command) => {
    setBusy(name);
    setNote(undefined);
    try {
      await api.robots.command(robot.id, name);
      setNote('Perintah terkirim');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div
      onClick={onSelect}
      className={cx('cursor-pointer rounded-lg border p-3 transition', selected ? 'border-accent bg-accent/5' : 'border-ink-600 bg-ink-800/50 hover:border-ink-500')}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cx('h-2 w-2 rounded-full', online ? 'bg-ok' : 'bg-slate-600')} />
          <span className="font-medium">{robot.name}</span>
        </div>
        <Badge tone={online ? nav.tone : 'muted'}>{online ? nav.label : 'Offline'}</Badge>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Baterai</div>
          <div className={cx('font-mono', battery !== null && battery < 25 ? 'text-danger' : 'text-slate-200')}>{battery === null ? '—' : `${battery}%`}</div>
        </div>
        <div>
          <div className="text-slate-500">Mode</div>
          <div className="text-slate-200">{telemetry?.mode === 'remote' ? 'Remote' : 'Otomatis'}</div>
        </div>
        <div>
          <div className="text-slate-500">Orang</div>
          <div className="font-mono text-slate-200">{telemetry?.people ?? 0}</div>
        </div>
      </div>
      <div className="mt-2 truncate text-xs text-slate-400">{online ? telemetry?.mission || telemetry?.nav.message || '—' : `Terakhir terlihat ${ago(robot.last_seen)}`}</div>
      {selected && online && (
        <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
          {telemetry?.nav.state === 'PAUSED' ? (
            <Button disabled={!!busy} onClick={() => send('resume')}>Lanjutkan</Button>
          ) : (
            <Button disabled={!!busy} onClick={() => send('pause')}>Jeda</Button>
          )}
          <Button disabled={!!busy} onClick={() => send('localize')}>Lokalisasi</Button>
          <Button variant="danger" disabled={!!busy} onClick={() => confirm(`Hentikan patroli ${robot.name}?`) && send('stop_patrol')}>
            Hentikan
          </Button>
          {note && <span className="w-full text-xs text-slate-400">{note}</span>}
        </div>
      )}
    </div>
  );
}
