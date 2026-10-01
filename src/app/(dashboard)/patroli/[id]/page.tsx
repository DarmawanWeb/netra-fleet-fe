'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { FloorPlanView } from '@/components/FloorPlanView';
import { AnomalyPin, RouteLayer } from '@/components/MapLayers';
import { Badge, Button, Empty, ErrorNote, PageTitle, Panel, Stat } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, fmtDuration, fmtTime } from '@/lib/format';
import { useAsync, useRules } from '@/lib/hooks';
import { EVENT_LABEL, navState, PATROL_STATUS } from '@/lib/labels';
import { useLive } from '@/lib/live';

export default function PatrolDetailPage() {
  const id = Number(useParams<{ id: string }>().id);
  const router = useRouter();
  const { revision } = useLive();
  const rules = useRules();
  const detail = useAsync(() => api.patrols.get(id), [id, revision]);
  const events = useAsync(() => api.events(undefined, id), [id, revision]);
  const anomalies = useAsync(
    () => api.anomalies.list({ patrolId: id }, { from: new Date(0), to: new Date() }),
    [id, revision],
  );
  const p = detail.data?.patrol;
  const recap = detail.data?.recap;
  const route = useAsync(() => (p?.route_id ? api.routes.get(p.route_id) : Promise.resolve(undefined)), [p?.route_id]);
  const robots = useAsync(() => api.robots.list(), []);
  const plans = useAsync(() => api.floorPlans.list(), []);
  const plan = useMemo(() => {
    const planId = robots.data?.find((r) => r.id === p?.robot_id)?.floor_plan_id;
    return plans.data?.find((x) => x.id === planId) ?? plans.data?.[0];
  }, [robots.data, plans.data, p?.robot_id]);

  if (!p || !recap) return <ErrorNote error={detail.error} />;
  const total = Object.values(recap.anomalies).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageTitle
        title={`Patroli #${p.id}`}
        subtitle={`${p.robot_id} · ${route.data?.name ?? 'rute'} · ${fmtDateTime(p.started_at ?? p.created_at)}`}
        actions={
          <>
            <Badge tone={PATROL_STATUS[p.status].tone}>{PATROL_STATUS[p.status].label}</Badge>
            {(p.status === 'running' || p.status === 'requested') && (
              <Button variant="danger" onClick={() => api.patrols.stop(p.id).then(detail.reload)}>Hentikan</Button>
            )}
            <Link href="/patroli" className="text-sm text-accent">← Kembali</Link>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Durasi" value={fmtDuration(p.started_at, p.finished_at)} />
        <Stat label="Putaran" value={p.laps} />
        <Stat label="Titik inspeksi" value={recap.events.inspected ?? recap.events.arrived ?? 0} hint={`${recap.events.skipped ?? 0} dilewati`} />
        <Stat label="Anomali" value={total} tone={total ? 'warn' : undefined} />
        <Stat label="Puncak keramaian" value={recap.crowd_peak} hint="orang dalam pandangan" />
      </div>
      {p.message && <div className="mb-4 text-sm text-slate-400">Catatan: {p.message}</div>}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {plan && (
            <FloorPlanView plan={plan} className="h-[460px]">
              {route.data?.points && <RouteLayer plan={plan} points={route.data.points} />}
              {anomalies.data?.filter((a) => a.x !== null && a.y !== null && a.status !== 'rejected').map((a) => (
                <AnomalyPin key={a.id} plan={plan} x={a.x!} y={a.y!} pending={a.status === 'needs_validation'}
                  label={rules.label(a.final_category ?? a.early_category)} onClick={() => router.push(`/anomali/${a.id}`)} />
              ))}
            </FloorPlanView>
          )}
          <Panel title="Anomali per Kategori">
            {total ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(recap.anomalies).map(([c, n]) => (
                  <span key={c} className="rounded border border-ink-500 px-3 py-1.5 text-sm">
                    {rules.label(c)} <b className="ml-1 font-mono text-warn">{n}</b>
                  </span>
                ))}
              </div>
            ) : (
              <Empty>Tidak ada anomali.</Empty>
            )}
          </Panel>
        </div>
        <Panel title="Linimasa">
          <ul className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
            {(events.data ?? []).map((e) => {
              const ev = String(e.payload.event ?? '');
              const text =
                e.type === 'alert'
                  ? `Peringatan: ${navState(String(e.payload.state)).label}`
                  : e.type === 'stop_event'
                    ? `${EVENT_LABEL[ev] ?? ev} #${Number(e.payload.index) + 1}`
                    : EVENT_LABEL[ev] ?? e.type;
              return (
                <li key={e.id} className={`border-l-2 pl-3 text-sm ${e.type === 'alert' ? 'border-danger' : 'border-ink-500'}`}>
                  <span className="font-mono text-xs text-slate-500">{fmtTime(e.ts)}</span> {text}
                </li>
              );
            })}
            {!events.data?.length && <Empty>Belum ada kejadian.</Empty>}
          </ul>
        </Panel>
      </div>
    </>
  );
}
