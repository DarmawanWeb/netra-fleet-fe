'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Empty, ErrorNote, Field, PageTitle, Panel, Segmented, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, fmtDuration, RANGE_PRESETS } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { PATROL_STATUS } from '@/lib/labels';
import { useLive } from '@/lib/live';

export default function PatrolsPage() {
  const { revision } = useLive();
  const [preset, setPreset] = useState('7d');
  const [robotId, setRobotId] = useState('');
  const range = (RANGE_PRESETS.find((p) => p.key === preset) ?? RANGE_PRESETS[2]!).range;
  const patrols = useAsync(() => api.patrols.list(range(), robotId || undefined), [preset, robotId, revision]);
  const robots = useAsync(() => api.robots.list(), []);
  const routes = useAsync(() => api.routes.list(), [revision]);
  const routeName = (id: number | null) => routes.data?.find((r) => r.id === id)?.name ?? (id ? `#${id}` : '—');

  const [startRobot, setStartRobot] = useState('');
  const [startRoute, setStartRoute] = useState('');
  const [error, setError] = useState<string>();
  const start = async () => {
    setError(undefined);
    try {
      await api.patrols.start(startRobot, Number(startRoute));
      patrols.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memulai patroli');
    }
  };

  return (
    <>
      <PageTitle
        title="Patroli"
        subtitle="Riwayat dan rekap setiap patroli"
        actions={<Segmented value={preset} onChange={setPreset} options={RANGE_PRESETS.map((p) => ({ value: p.key, label: p.label }))} />}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Panel
          title="Riwayat"
          actions={
            <Select value={robotId} onChange={(e) => setRobotId(e.target.value)} className="w-40">
              <option value="">Semua robot</option>
              {robots.data?.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          }
        >
          <ErrorNote error={patrols.error} />
          {patrols.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Robot</th>
                  <th>Rute</th>
                  <th>Mulai</th>
                  <th>Durasi</th>
                  <th>Putaran</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patrols.data.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-800">
                    <td><Link href={`/patroli/${p.id}`} className="text-accent">{p.id}</Link></td>
                    <td>{p.robot_id}</td>
                    <td>{routeName(p.route_id)}</td>
                    <td>{fmtDateTime(p.started_at ?? p.created_at)}</td>
                    <td>{fmtDuration(p.started_at, p.finished_at)}</td>
                    <td className="font-mono">{p.laps}</td>
                    <td><Badge tone={PATROL_STATUS[p.status].tone}>{PATROL_STATUS[p.status].label}</Badge>{p.schedule_id && <span className="ml-1 text-[10px] text-slate-500">terjadwal</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Belum ada patroli pada rentang ini.</Empty>
          )}
        </Panel>
        <Panel title="Mulai Patroli Sekarang">
          <div className="space-y-3">
            <Field label="Robot">
              <Select value={startRobot} onChange={(e) => (setStartRobot(e.target.value), setStartRoute(''))}>
                <option value="">Pilih robot</option>
                {robots.data?.map((r) => (
                  <option key={r.id} value={r.id} disabled={!r.online}>{r.name}{r.online ? '' : ' (offline)'}</option>
                ))}
              </Select>
            </Field>
            <Field label="Rute">
              <Select value={startRoute} onChange={(e) => setStartRoute(e.target.value)} disabled={!startRobot}>
                <option value="">Pilih rute</option>
                {routes.data?.filter((r) => r.robot_id === startRobot).map((r) => (
                  <option key={r.id} value={r.id}>{r.name} · {r.length_m.toFixed(0)} m · {r.stops} titik</option>
                ))}
              </Select>
            </Field>
            <ErrorNote error={error} />
            <Button variant="primary" className="w-full" disabled={!startRobot || !startRoute} onClick={start}>Mulai</Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
