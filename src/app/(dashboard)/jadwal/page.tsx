'use client';

import { useState } from 'react';
import { Badge, Button, Empty, ErrorNote, Field, Input, PageTitle, Panel, Select, Toggle, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { DAYS } from '@/lib/labels';
import type { Schedule } from '@/lib/types';

type Draft = Omit<Schedule, 'id' | 'last_run_on'> & { id?: number };
const EMPTY: Draft = { robot_id: '', route_id: 0, name: '', days: [1, 2, 3, 4, 5], time_of_day: '09:00', enabled: true };

export default function SchedulesPage() {
  const schedules = useAsync(() => api.schedules.list(), []);
  const robots = useAsync(() => api.robots.list(), []);
  const routes = useAsync(() => api.routes.list(), []);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string>();
  const routeName = (id: number) => routes.data?.find((r) => r.id === id)?.name ?? `#${id}`;

  const save = async () => {
    setError(undefined);
    try {
      await api.schedules.save(draft);
      setDraft(EMPTY);
      schedules.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    }
  };
  const toggle = async (s: Schedule) => {
    await api.schedules.save({ ...s, enabled: !s.enabled });
    schedules.reload();
  };

  return (
    <>
      <PageTitle title="Jadwal Patroli" subtitle="Patroli otomatis per hari dan jam (WIB)" />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel title="Jadwal">
          {schedules.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Robot</th>
                  <th>Rute</th>
                  <th>Hari</th>
                  <th>Jam</th>
                  <th>Terakhir</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {schedules.data.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.robot_id}</td>
                    <td>{routeName(s.route_id)}</td>
                    <td className="text-xs">{s.days.length === 7 ? 'Setiap hari' : s.days.map((d) => DAYS[d]).join(', ')}</td>
                    <td className="font-mono">{s.time_of_day}</td>
                    <td className="text-xs text-slate-400">{s.last_run_on ?? '—'}</td>
                    <td className="space-x-2 whitespace-nowrap text-right">
                      <Toggle checked={s.enabled} onChange={() => toggle(s)} />
                      <Button onClick={() => setDraft(s)}>Ubah</Button>
                      <Button variant="danger" onClick={() => confirm(`Hapus jadwal ${s.name}?`) && api.schedules.remove(s.id).then(schedules.reload)}>Hapus</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Belum ada jadwal.</Empty>
          )}
        </Panel>
        <Panel title={draft.id ? 'Ubah Jadwal' : 'Jadwal Baru'} actions={draft.id ? <Badge tone="info">#{draft.id}</Badge> : null}>
          <div className="space-y-3">
            <Field label="Nama">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Patroli pagi" />
            </Field>
            <Field label="Robot">
              <Select value={draft.robot_id} onChange={(e) => setDraft({ ...draft, robot_id: e.target.value, route_id: 0 })}>
                <option value="">Pilih robot</option>
                {robots.data?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Rute">
              <Select value={draft.route_id || ''} onChange={(e) => setDraft({ ...draft, route_id: Number(e.target.value) })}>
                <option value="">Pilih rute</option>
                {routes.data?.filter((r) => r.robot_id === draft.robot_id).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Hari">
              <div className="flex gap-1">
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDraft({ ...draft, days: draft.days.includes(i) ? draft.days.filter((x) => x !== i) : [...draft.days, i].sort() })}
                    className={cx('flex-1 rounded py-1.5 text-xs', draft.days.includes(i) ? 'bg-accent text-ink-950' : 'border border-ink-500 text-slate-400')}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Jam (WIB)">
              <Input type="time" value={draft.time_of_day} onChange={(e) => setDraft({ ...draft, time_of_day: e.target.value })} />
            </Field>
            <Toggle checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} label="Aktif" />
            <ErrorNote error={error} />
            <div className="flex gap-2">
              <Button variant="primary" disabled={!draft.robot_id || !draft.route_id || !draft.days.length} onClick={save}>Simpan</Button>
              {draft.id && <Button onClick={() => setDraft(EMPTY)}>Batal</Button>}
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
