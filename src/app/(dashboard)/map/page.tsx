'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { FloorPlanView } from '@/components/FloorPlanView';
import { GridMapView } from '@/components/GridMapView';
import { AnomalyPin, HeatLayer, RobotMarker, RouteLayer } from '@/components/MapLayers';
import { Empty, ErrorNote, PageTitle, Panel, Segmented, Select, cx } from '@/components/ui';
import { useI18n, type MessageKey } from '@/i18n';
import { api } from '@/lib/api';
import { useAsync, useRules } from '@/lib/hooks';
import { navTone } from '@/lib/labels';
import { useLive } from '@/lib/live';
import type { RoutePoint } from '@/lib/types';
import { EventFeed } from './_components/EventFeed';
import { RobotCard } from './_components/RobotCard';

type Layer = 'robots' | 'routes' | 'anomalies' | 'crowd';
type Mode = 'plan' | 'grid';
const MODE_KEY = 'netra.map.mode';
const VIEW_ROUTE_KEY = 'netra.map.route';
const LAYERS: { key: Layer; label: MessageKey; swatch: string }[] = [
  { key: 'robots', label: 'map.robots', swatch: 'bg-accent' },
  { key: 'routes', label: 'map.routes', swatch: 'bg-cyan-700' },
  { key: 'anomalies', label: 'map.anomalies', swatch: 'bg-warn' },
  { key: 'crowd', label: 'map.crowdLastHour', swatch: 'bg-gradient-to-r from-cyan-400 via-green-500 to-red-500' },
];

export default function MapPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { telemetry, online, revision } = useLive();
  const rules = useRules();
  const robots = useAsync(() => api.robots.list(), [revision]);
  const plans = useAsync(() => api.floorPlans.list(), []);
  const anomalies = useAsync(() => api.anomalies.list({}, { from: new Date(Date.now() - 864e5), to: new Date() }), [revision]);
  const [planId, setPlanId] = useState<number>();
  const [selected, setSelected] = useState<string>();
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ robots: true, routes: true, anomalies: true, crowd: false });
  const heat = useAsync(
    () => (layers.crowd ? api.crowd.heatmap({ from: new Date(Date.now() - 3600e3), to: new Date() }) : Promise.resolve([])),
    [layers.crowd, revision],
  );
  const [routes, setRoutes] = useState<Record<number, RoutePoint[]>>({});
  const [mode, setModeState] = useState<Mode>('plan');
  useEffect(() => {
    try {
      if (localStorage.getItem(MODE_KEY) === 'grid') setModeState('grid');
    } catch {
      /* not remembered */
    }
  }, []);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* not remembered */
    }
  };

  const plan = useMemo(() => {
    const list = plans.data ?? [];
    const preferred = planId ?? robots.data?.find((r) => r.floor_plan_id)?.floor_plan_id ?? list[0]?.id;
    return list.find((p) => p.id === preferred);
  }, [plans.data, planId, robots.data]);
  // A plan without scale cannot place robots: the grid in map coordinates is used instead.
  const calibrated = !!plan && plan.px_per_m > 0;
  const grid = !calibrated || mode === 'grid';

  // Routes to show: the ones being patrolled plus the one picked to view.
  const routeList = useAsync(() => api.routes.list(), []);
  const [viewRoute, setViewRouteState] = useState<number | null>(null);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(VIEW_ROUTE_KEY));
      if (saved) setViewRouteState(saved);
    } catch {
      /* not remembered */
    }
  }, []);
  const setViewRoute = (id: number | null) => {
    setViewRouteState(id);
    try {
      if (id) localStorage.setItem(VIEW_ROUTE_KEY, String(id));
      else localStorage.removeItem(VIEW_ROUTE_KEY);
    } catch {
      /* not remembered */
    }
  };
  const activeRouteIds = useMemo(
    () => [
      ...new Set([
        ...Object.values(telemetry)
          .map((tel) => tel.patrol?.route_id)
          .filter((id): id is number => !!id),
        ...(viewRoute ? [viewRoute] : []),
      ]),
    ],
    [telemetry, viewRoute],
  );
  useEffect(() => {
    activeRouteIds
      .filter((id) => !routes[id])
      .forEach((id) =>
        api.routes
          .get(id)
          .then((r) => setRoutes((m) => ({ ...m, [id]: r.points ?? [] })))
          .catch(() => undefined),
      );
  }, [activeRouteIds, routes]);

  const visibleAnomalies = (anomalies.data ?? []).filter(
    (a) => a.x !== null && a.y !== null && !['rejected', 'dismissed'].includes(a.status),
  );
  const pending = (anomalies.data ?? []).filter((a) => a.status === 'needs_validation').length;

  return (
    <>
      <PageTitle
        title={t('map.title')}
        subtitle={t('map.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={viewRoute ?? ''}
              onChange={(e) => setViewRoute(e.target.value ? Number(e.target.value) : null)}
              className="w-56"
              aria-label={t('map.showRoute')}
            >
              <option value="">{t('map.showRoute')}</option>
              {(routeList.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.length_m.toFixed(0)} m · {t('map.routeStops', { n: r.stops })}
                </option>
              ))}
            </Select>
            {calibrated && (
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'plan', label: t('map.viewPlan') },
                  { value: 'grid', label: t('map.viewGrid') },
                ]}
              />
            )}
            {!grid && (plans.data?.length ?? 0) > 1 && (
              <Select value={plan?.id ?? ''} onChange={(e) => setPlanId(Number(e.target.value))} className="w-48">
                {plans.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        }
      />
      <ErrorNote error={robots.error ?? plans.error} />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="relative">
          {grid ? (
            <>
              <GridMapView
                className="h-[calc(100vh-190px)] min-h-[480px]"
                robots={
                  layers.robots
                    ? (robots.data ?? []).flatMap((r) => {
                        const tel = telemetry[r.id];
                        return online[r.id] && tel?.pose
                          ? [{ id: r.id, name: r.name, pose: tel.pose, alarm: navTone(tel.nav.state) === 'danger' }]
                          : [];
                      })
                    : []
                }
                routes={layers.routes ? activeRouteIds.flatMap((id) => (routes[id] ? [routes[id]!] : [])) : []}
                anomalies={
                  layers.anomalies
                    ? visibleAnomalies.map((a) => ({
                        id: a.id,
                        x: a.x!,
                        y: a.y!,
                        pending: a.status === 'needs_validation',
                        label: rules.label(a.final_category ?? a.early_category),
                      }))
                    : []
                }
                onAnomaly={(id) => router.push(`/anomalies/${id}`)}
              />
              {!calibrated && (
                <p className="mt-2 text-xs text-slate-500">
                  {t('map.gridNoPlan')}{' '}
                  <Link href="/floor-plans" className="text-accent underline">
                    {t('map.uploadPlan')}
                  </Link>
                </p>
              )}
            </>
          ) : plan ? (
            <FloorPlanView plan={plan} className="h-[calc(100vh-190px)] min-h-[480px]">
              {layers.crowd && <HeatLayer plan={plan} cells={heat.data ?? []} unit={t('crowd.people')} />}
              {layers.routes && activeRouteIds.map((id) => routes[id] && <RouteLayer key={id} plan={plan} points={routes[id]!} />)}
              {layers.anomalies &&
                visibleAnomalies.map((a) => (
                  <AnomalyPin
                    key={a.id}
                    plan={plan}
                    x={a.x!}
                    y={a.y!}
                    pending={a.status === 'needs_validation'}
                    label={rules.label(a.final_category ?? a.early_category)}
                    onClick={() => router.push(`/anomalies/${a.id}`)}
                  />
                ))}
              {layers.robots &&
                (robots.data ?? []).map((r) => {
                  const tel = telemetry[r.id];
                  if (!online[r.id] || !tel?.pose) return null;
                  return <RobotMarker key={r.id} plan={plan} pose={tel.pose} name={r.name} alarm={navTone(tel.nav.state) === 'danger'} />;
                })}
            </FloorPlanView>
          ) : (
            <Panel>
              <Empty>
                {t('map.noPlan')}{' '}
                <Link href="/floor-plans" className="text-accent underline">
                  {t('map.uploadPlan')}
                </Link>
              </Empty>
            </Panel>
          )}
          {
            <div className="absolute left-3 top-3 rounded-lg border border-ink-600 bg-ink-900/90 p-2 text-xs shadow-lg backdrop-blur">
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{t('map.layers')}</div>
              {LAYERS.filter((l) => !grid || l.key !== 'crowd').map((l) => (
                <label key={l.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-ink-700">
                  <input
                    type="checkbox"
                    checked={layers[l.key]}
                    onChange={(e) => setLayers((s) => ({ ...s, [l.key]: e.target.checked }))}
                    className="accent-cyan-500"
                  />
                  <span className={cx('h-2.5 w-2.5 rounded-sm', l.swatch)} />
                  <span className="text-slate-300">{t(l.label)}</span>
                </label>
              ))}
            </div>
          }
        </div>
        <div className="space-y-4">
          <Panel title={t('map.fleet')}>
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
              {!robots.data?.length && <Empty>{t('map.noRobots')}</Empty>}
            </div>
          </Panel>
          <Panel
            title={t('map.anomalies')}
            actions={
              <Link href="/anomalies" className="text-xs text-accent">
                {t('map.viewAll')}
              </Link>
            }
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-400">{t('map.needsValidation')}</span>
              <span className="font-mono text-2xl text-warn">{pending}</span>
            </div>
          </Panel>
          <Panel title={t('map.liveEvents')}>
            <EventFeed label={rules.label} />
          </Panel>
        </div>
      </div>
    </>
  );
}
