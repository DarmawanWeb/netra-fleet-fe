'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { FloorPlanView } from '@/components/FloorPlanView';
import { AnomalyPin, HeatLayer, RobotMarker, RouteLayer } from '@/components/MapLayers';
import { Empty, ErrorNote, PageTitle, Panel, Select, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { useAsync, useRules } from '@/lib/hooks';
import { NAV_STATE } from '@/lib/labels';
import { useLive } from '@/lib/live';
import type { RoutePoint } from '@/lib/types';
import { EventFeed } from './_components/EventFeed';
import { RobotCard } from './_components/RobotCard';

export default function MapPage() {
  const router = useRouter();
  const { telemetry, online, revision } = useLive();
  const rules = useRules();
  const robots = useAsync(() => api.robots.list(), [revision]);
  const plans = useAsync(() => api.floorPlans.list(), []);
  const anomalies = useAsync(
    () => api.anomalies.list({}, { from: new Date(Date.now() - 864e5), to: new Date() }),
    [revision],
  );
  const [planId, setPlanId] = useState<number>();
  const [selected, setSelected] = useState<string>();
  const [showHeat, setShowHeat] = useState(false);
  const heat = useAsync(
    () => (showHeat ? api.crowd.heatmap({ from: new Date(Date.now() - 3600e3), to: new Date() }) : Promise.resolve([])),
    [showHeat, revision],
  );
  const [routes, setRoutes] = useState<Record<number, RoutePoint[]>>({});

  const plan = useMemo(() => {
    const list = plans.data ?? [];
    const preferred = planId ?? robots.data?.find((r) => r.floor_plan_id)?.floor_plan_id ?? list[0]?.id;
    return list.find((p) => p.id === preferred);
  }, [plans.data, planId, robots.data]);

  const activeRouteIds = useMemo(
    () => [...new Set(Object.values(telemetry).map((t) => t.patrol?.route_id).filter((id): id is number => !!id))],
    [telemetry],
  );
  useEffect(() => {
    activeRouteIds
      .filter((id) => !routes[id])
      .forEach((id) => api.routes.get(id).then((r) => setRoutes((m) => ({ ...m, [id]: r.points ?? [] }))).catch(() => undefined));
  }, [activeRouteIds, routes]);

  const visibleAnomalies = (anomalies.data ?? []).filter(
    (a) => a.x !== null && a.y !== null && !['rejected', 'dismissed'].includes(a.status),
  );
  const pending = visibleAnomalies.filter((a) => a.status === 'needs_validation').length;

  return (
    <>
      <PageTitle
        title="Peta Operasi"
        subtitle="Posisi robot, rute aktif dan anomali 24 jam terakhir"
        actions={
          <>
            <Toggle checked={showHeat} onChange={setShowHeat} label="Keramaian 1 jam" />
            {(plans.data?.length ?? 0) > 1 && (
              <Select value={plan?.id ?? ''} onChange={(e) => setPlanId(Number(e.target.value))} className="w-48">
                {plans.data?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            )}
          </>
        }
      />
      <ErrorNote error={robots.error ?? plans.error} />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {plan ? (
            <FloorPlanView plan={plan} className="h-[calc(100vh-190px)] min-h-[480px]">
              {showHeat && <HeatLayer plan={plan} cells={heat.data ?? []} />}
              {activeRouteIds.map((id) => routes[id] && <RouteLayer key={id} plan={plan} points={routes[id]!} />)}
              {visibleAnomalies.map((a) => (
                <AnomalyPin
                  key={a.id}
                  plan={plan}
                  x={a.x!}
                  y={a.y!}
                  pending={a.status === 'needs_validation'}
                  label={rules.label(a.final_category ?? a.early_category)}
                  onClick={() => router.push(`/anomali/${a.id}`)}
                />
              ))}
              {(robots.data ?? []).map((r) => {
                const t = telemetry[r.id];
                if (!online[r.id] || !t?.pose) return null;
                return <RobotMarker key={r.id} plan={plan} pose={t.pose} name={r.name} alarm={NAV_STATE[t.nav.state]?.tone === 'danger'} />;
              })}
            </FloorPlanView>
          ) : (
            <Panel>
              <Empty>
                Belum ada denah. <Link href="/denah" className="text-accent underline">Unggah denah mall</Link> dan kalibrasi posisi base robot.
              </Empty>
            </Panel>
          )}
        </div>
        <div className="space-y-4">
          <Panel title="Armada">
            <div className="space-y-2">
              {(robots.data ?? []).map((r) => (
                <RobotCard
                  key={r.id}
                  robot={r}
                  telemetry={telemetry[r.id] ?? r.last_telemetry}
                  online={online[r.id] ?? r.online}
                  selected={selected === r.id}
                  onSelect={() => setSelected(selected === r.id ? undefined : r.id)}
                />
              ))}
              {!robots.data?.length && <Empty>Belum ada robot terdaftar.</Empty>}
            </div>
          </Panel>
          <Panel title="Anomali" actions={<Link href="/anomali" className="text-xs text-accent">Lihat semua</Link>}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-400">Perlu validasi</span>
              <span className="font-mono text-2xl text-warn">{pending}</span>
            </div>
          </Panel>
          <Panel title="Kejadian Langsung">
            <EventFeed label={rules.label} />
          </Panel>
        </div>
      </div>
    </>
  );
}
