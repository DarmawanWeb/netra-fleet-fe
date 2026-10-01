'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FloorPlanView } from '@/components/FloorPlanView';
import { AnomalyPin, RouteLayer } from '@/components/MapLayers';
import { Badge, Button, ErrorNote, Field, Input, PageTitle, Panel, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, fmtPct } from '@/lib/format';
import { useAsync, useRules } from '@/lib/hooks';
import { ANOMALY_STATUS } from '@/lib/labels';

export default function AnomalyDetailPage() {
  const id = Number(useParams<{ id: string }>().id);
  const rules = useRules();
  const anomaly = useAsync(() => api.anomalies.get(id), [id]);
  const robots = useAsync(() => api.robots.list(), []);
  const plans = useAsync(() => api.floorPlans.list(), []);
  const a = anomaly.data;
  const route = useAsync(() => (a?.route_id ? api.routes.get(a.route_id) : Promise.resolve(undefined)), [a?.route_id]);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const plan = useMemo(() => {
    const planId = robots.data?.find((r) => r.id === a?.robot_id)?.floor_plan_id;
    return plans.data?.find((p) => p.id === planId) ?? plans.data?.[0];
  }, [robots.data, plans.data, a?.robot_id]);

  const decide = async (decision: 'confirm' | 'reject') => {
    setBusy(true);
    setError(undefined);
    try {
      await api.anomalies.validate(id, decision, category || undefined, note || undefined);
      anomaly.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setBusy(false);
    }
  };

  if (!a) return <ErrorNote error={anomaly.error} />;
  const status = ANOMALY_STATUS[a.status];
  return (
    <>
      <PageTitle
        title={`Anomali #${a.id} — ${rules.label(a.final_category ?? a.early_category)}`}
        subtitle={`${fmtDateTime(a.detected_at)} · ${a.robot_id}`}
        actions={<Link href="/anomali" className="text-sm text-accent">← Kembali</Link>}
      />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Gambar" actions={<Badge tone={status.tone}>{status.label}</Badge>}>
          <img src={api.anomalies.imageUrl(a.id)} alt="" className="w-full rounded" />
        </Panel>
        <div className="space-y-4">
          <Panel title="Hasil Deteksi">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-400">Deteksi awal (robot)</dt>
              <dd>{rules.label(a.early_category)} · {fmtPct(a.early_confidence)}</dd>
              <dt className="text-slate-400">Deteksi final</dt>
              <dd>{a.final_category ? `${rules.label(a.final_category)} · ${fmtPct(a.final_confidence)}` : 'Menunggu'}</dd>
              <dt className="text-slate-400">Keterangan</dt>
              <dd>{a.final_note || a.early_note || '—'}</dd>
              <dt className="text-slate-400">Posisi</dt>
              <dd className="font-mono">{a.x !== null && a.y !== null ? `${a.x.toFixed(2)}, ${a.y.toFixed(2)} m` : '—'}</dd>
              <dt className="text-slate-400">Patroli</dt>
              <dd>{a.patrol_id ? <Link className="text-accent" href={`/patroli/${a.patrol_id}`}>#{a.patrol_id}</Link> : '—'}</dd>
              <dt className="text-slate-400">Validasi</dt>
              <dd>{a.validated_by ? `${a.validated_by}, ${fmtDateTime(a.validated_at)}` : '—'}</dd>
              <dt className="text-slate-400">Telegram</dt>
              <dd>{a.notified_at ? fmtDateTime(a.notified_at) : 'Belum dikirim'}</dd>
            </dl>
          </Panel>
          {a.status === 'needs_validation' && (
            <Panel title="Validasi Operator">
              <div className="space-y-3">
                <Field label="Kategori (ubah bila salah)">
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">{rules.label(a.final_category ?? a.early_category)}</option>
                    {rules.data?.map((r) => (
                      <option key={r.category} value={r.category}>{r.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Catatan">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" />
                </Field>
                <ErrorNote error={error} />
                <div className="flex gap-2">
                  <Button variant="ok" disabled={busy} onClick={() => decide('confirm')}>Konfirmasi</Button>
                  <Button variant="danger" disabled={busy} onClick={() => decide('reject')}>Tolak</Button>
                </div>
              </div>
            </Panel>
          )}
          {plan && a.x !== null && a.y !== null && (
            <FloorPlanView plan={plan} className="h-72">
              {route.data?.points && <RouteLayer plan={plan} points={route.data.points} color="#64748b" />}
              <AnomalyPin plan={plan} x={a.x} y={a.y} pending={a.status === 'needs_validation'} label="" />
            </FloorPlanView>
          )}
        </div>
      </div>
    </>
  );
}
