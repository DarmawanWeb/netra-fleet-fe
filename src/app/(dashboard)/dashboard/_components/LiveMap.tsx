'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { GeoOrGrid, GeoPrompt, type GeoFocus, type TrailPoint } from '@/components/GeoMapView';
import { GridMapView, type GridFocus } from '@/components/GridMapView';
import { FloorPlanView, type Focus } from '@/components/FloorPlanView';
import { IconClose, IconCrosshair } from '@/components/icons';
import { AnomalyPin, HeatLayer, RobotMarker, RouteLayer, TrailLayer } from '@/components/MapLayers';
import { Select, cx } from '@/components/ui';
import { useI18n, type MessageKey } from '@/i18n';
import { robotLatLon, validFix } from '@/lib/geo';
import { mapToPlan } from '@/lib/geometry';
import { useGeoSite } from '@/lib/hooks';
import { robotTone } from '@/lib/labels';
import { useTheme } from '@/lib/theme';
import { useMe } from '@/lib/session';
import type { Anomaly, Feature, FloorPlan, HeatCell, Robot, RoutePoint, Telemetry } from '@/lib/types';

export type Layer = 'robots' | 'trails' | 'routes' | 'anomalies' | 'crowd';
/** The planned route is drawn neutral so the robot and its trail (cyan) stand out against it. */
const ROUTE_COLOR = { dark: '#94a3b8', light: '#64748b' };
/** Width of the view (metres) while following a robot on the grid, and the zoom on the GPS map. */
const FOLLOW_W = 40;
const FOLLOW_ZOOM = 19;
const LAYERS: { key: Layer; label: MessageKey; swatch: string; feature?: Feature }[] = [
  { key: 'robots', label: 'map.robots', swatch: 'bg-cyan-400' },
  { key: 'trails', label: 'dashboard.trails', swatch: 'bg-cyan-400/50' },
  { key: 'routes', label: 'map.routes', swatch: 'bg-slate-400' },
  { key: 'anomalies', label: 'map.anomalies', swatch: 'bg-amber-500', feature: 'anomaly' },
  { key: 'crowd', label: 'map.crowdLastHour', swatch: 'bg-gradient-to-r from-cyan-400 via-green-500 to-red-500', feature: 'crowd' },
];

/**
 * The floor plan (or robot map), the GPS map on a GPS site, or without either the grid in the
 * robot's map frame, with robots, their trails, active routes, anomaly pins and the crowd of the
 * last hour, each switchable.
 */
export function LiveMap({
  plans,
  robots,
  telemetry,
  online,
  trails,
  routePoints,
  anomalies,
  fresh,
  heat,
  layers,
  onLayers,
  selected,
  follow,
  onSelect,
  onFollow,
  label,
  className,
}: {
  plans: FloorPlan[] | undefined;
  robots: Robot[];
  telemetry: Record<string, Telemetry>;
  online: Record<string, boolean>;
  trails: Record<string, TrailPoint[]>;
  routePoints: Record<number, RoutePoint[]>;
  anomalies: Anomaly[];
  fresh: Set<number>;
  heat: HeatCell[];
  layers: Record<Layer, boolean>;
  onLayers: (l: Record<Layer, boolean>) => void;
  selected?: string;
  follow: boolean;
  onSelect: (id: string) => void;
  onFollow: (on: boolean) => void;
  label: (c: string) => string;
  className?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { has, mapMode } = useMe();
  const { theme } = useTheme();
  const [planId, setPlanId] = useState<number>();
  const geo = useGeoSite();
  const gps = mapMode === 'gps';
  const transform = geo.site?.transform ?? null;

  const plan = useMemo(() => {
    const list = plans ?? [];
    const preferred = planId ?? robots.find((r) => r.floor_plan_id)?.floor_plan_id ?? list[0]?.id;
    return list.find((p) => p.id === preferred);
  }, [plans, planId, robots]);
  // No calibrated floor plan yet: a metric grid in the robot's map frame.
  const grid = !plan || !(plan.px_per_m > 0);

  // On a GPS site a robot with a fix is shown even without a map pose.
  const live = robots.filter((r) => (online[r.id] ?? r.online) && (telemetry[r.id]?.pose || (gps && validFix(telemetry[r.id]?.gps))));
  const followed = follow && selected ? telemetry[selected]?.pose : null;
  const followedTel = follow && selected ? telemetry[selected] : undefined;
  const followedAt = gps && followedTel ? robotLatLon(followedTel.pose, followedTel.gps, transform) : null;
  const geoFocus = useMemo<GeoFocus | null>(
    () => (followedAt ? { lat: followedAt[0], lon: followedAt[1], zoom: FOLLOW_ZOOM } : null),
    // Re-centre on every position of the followed robot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [followedAt?.[0], followedAt?.[1]],
  );
  const focus = useMemo<Focus | null>(() => {
    if (grid || !plan || !followed) return null;
    const { px, py } = mapToPlan(plan, followed.x, followed.y);
    return { px, py, w: Math.min(plan.width_px || 1000, 70 * plan.px_per_m) };
    // Re-centre on every pose of the followed robot.
  }, [grid, plan, followed]);
  const gridFocus = useMemo<GridFocus | null>(
    () => (grid && followed ? { x: followed.x, y: followed.y, w: FOLLOW_W } : null),
    [grid, followed],
  );
  const activeRoutes = [
    ...new Set(
      live.map((r) => telemetry[r.id]?.patrol?.route_id).filter((id): id is number => typeof id === 'number' && !!routePoints[id]),
    ),
  ];
  const pinned = anomalies.filter((a) => a.x !== null && a.y !== null);
  const selectedRobot = robots.find((r) => r.id === selected);

  if (!plans || (gps && !geo.loaded)) return <div className={cx('rounded-b-xl bg-ink-950', className)} />;

  const layerButtons = (
    <div className="pointer-events-auto flex flex-wrap gap-1" role="group" aria-label={t('map.layers')}>
      {LAYERS.filter((l) => !l.feature || has(l.feature)).map((l) => (
        <button
          key={l.key}
          onClick={() => onLayers({ ...layers, [l.key]: !layers[l.key] })}
          aria-pressed={layers[l.key]}
          className={cx(
            'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] backdrop-blur transition-colors',
            layers[l.key]
              ? 'border-ink-500 bg-ink-900/90 text-slate-200'
              : 'border-ink-600 bg-ink-900/60 text-slate-500 line-through decoration-slate-600',
          )}
        >
          <span className={cx('h-2 w-2.5 rounded-sm', l.swatch, !layers[l.key] && 'opacity-30')} />
          {t(l.label)}
        </button>
      ))}
    </div>
  );

  const followChip = selectedRobot && (online[selectedRobot.id] ?? selectedRobot.online) && (
    <span className="flex items-center gap-1 rounded-md border border-ink-500 bg-ink-900/90 py-1 pl-2.5 pr-1 text-xs text-slate-200 backdrop-blur">
      <IconCrosshair width={14} height={14} className={follow ? 'text-accent' : 'text-slate-500'} aria-hidden />
      {follow ? (
        t('dashboard.following', { name: selectedRobot.name })
      ) : (
        <button className="hover:text-accent" onClick={() => onFollow(true)}>
          {t('dashboard.follow', { name: selectedRobot.name })}
        </button>
      )}
      <button
        className="rounded p-0.5 text-slate-400 hover:text-slate-100"
        onClick={() => onSelect(selectedRobot.id)}
        aria-label={t('dashboard.stopFollowing')}
        title={t('dashboard.stopFollowing')}
      >
        <IconClose width={14} height={14} />
      </button>
    </span>
  );

  if (gps)
    return (
      <div className={cx('relative', className)}>
        <GeoOrGrid
          site={geo.site}
          loaded={geo.loaded}
          fill
          className="h-full !rounded-none !border-0"
          prompt="none"
          robots={
            layers.robots
              ? live.map((r) => {
                  const tel = telemetry[r.id]!;
                  return {
                    id: r.id,
                    name: r.name,
                    pose: tel.pose,
                    gps: tel.gps,
                    tone: robotTone(tel),
                    selected: selected === r.id,
                    inspecting: tel.nav.state === 'DWELLING',
                  };
                })
              : []
          }
          routes={layers.routes ? activeRoutes.map((id) => routePoints[id]!) : []}
          routeColor={ROUTE_COLOR[theme]}
          trails={layers.trails ? live.map((r) => ({ id: r.id, points: trails[r.id] ?? [], tone: robotTone(telemetry[r.id]) })) : undefined}
          anomalies={
            layers.anomalies
              ? pinned.map((a) => ({
                  id: a.id,
                  x: a.x!,
                  y: a.y!,
                  pending: a.status === 'needs_validation',
                  fresh: fresh.has(a.id),
                  label: label(a.final_category ?? a.early_category),
                }))
              : []
          }
          heat={layers.crowd ? { cells: heat, unit: t('crowd.people') } : undefined}
          focus={geoFocus}
          gridFocus={transform ? null : gridFocus}
          onUserMove={() => follow && onFollow(false)}
          onRobot={onSelect}
          onAnomaly={(id) => router.push(`/anomalies/${id}`)}
        />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto flex flex-wrap gap-2">
            {!transform && (
              <span className="rounded bg-ink-900/85 px-2 py-1 backdrop-blur">
                <GeoPrompt short />
              </span>
            )}
            {followChip}
          </div>
          {layerButtons}
        </div>
      </div>
    );

  if (grid)
    return (
      <div className={cx('relative', className)}>
        <GridMapView
          className="h-full !rounded-none !border-0"
          robots={
            layers.robots
              ? live.map((r) => {
                  const tel = telemetry[r.id]!;
                  return {
                    id: r.id,
                    name: r.name,
                    pose: tel.pose!,
                    tone: robotTone(tel),
                    selected: selected === r.id,
                    inspecting: tel.nav.state === 'DWELLING',
                  };
                })
              : []
          }
          routes={layers.routes ? activeRoutes.map((id) => routePoints[id]!) : []}
          routeColor={ROUTE_COLOR[theme]}
          trails={layers.trails ? live.map((r) => ({ id: r.id, poses: trails[r.id] ?? [], tone: robotTone(telemetry[r.id]) })) : undefined}
          anomalies={
            layers.anomalies
              ? pinned.map((a) => ({
                  id: a.id,
                  x: a.x!,
                  y: a.y!,
                  pending: a.status === 'needs_validation',
                  fresh: fresh.has(a.id),
                  label: label(a.final_category ?? a.early_category),
                }))
              : []
          }
          heat={layers.crowd ? { cells: heat, unit: t('crowd.people') } : undefined}
          focus={gridFocus}
          onUserMove={() => follow && onFollow(false)}
          onRobot={onSelect}
          onAnomaly={(id) => router.push(`/anomalies/${id}`)}
        />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto flex flex-wrap gap-2">
            <Link
              href="/floor-plans"
              className="rounded bg-ink-900/85 px-2 py-1 text-[11px] text-slate-300 backdrop-blur hover:text-accent"
            >
              {mapMode === 'pgm' ? `${t('map.noRobotMap')} ${t('map.uploadRobotMap')}` : `${t('map.noPlan')} ${t('map.uploadPlan')}`}
            </Link>
            {followChip}
          </div>
          {layerButtons}
        </div>
      </div>
    );

  return (
    <div className={cx('relative', className)}>
      <FloorPlanView
        plan={plan}
        variant={theme === 'dark' ? 'night' : 'day'}
        focus={focus}
        onUserMove={() => follow && onFollow(false)}
        className="h-full !rounded-none !border-0"
      >
        {layers.crowd && <HeatLayer plan={plan} cells={heat} unit={t('crowd.people')} />}
        {layers.routes &&
          activeRoutes.map((id) => <RouteLayer key={id} plan={plan} points={routePoints[id]!} color={ROUTE_COLOR[theme]} />)}
        {layers.trails &&
          live.map((r) => <TrailLayer key={r.id} plan={plan} poses={trails[r.id] ?? []} tone={robotTone(telemetry[r.id])} />)}
        {layers.anomalies &&
          pinned.map((a) => (
            <AnomalyPin
              key={a.id}
              plan={plan}
              x={a.x!}
              y={a.y!}
              pending={a.status === 'needs_validation'}
              fresh={fresh.has(a.id)}
              label={label(a.final_category ?? a.early_category)}
              onClick={() => router.push(`/anomalies/${a.id}`)}
            />
          ))}
        {layers.robots &&
          live.map((r) => {
            const tel = telemetry[r.id]!;
            return (
              <RobotMarker
                key={r.id}
                plan={plan}
                pose={tel.pose!}
                name={r.name}
                tone={robotTone(tel)}
                selected={selected === r.id}
                inspecting={tel.nav.state === 'DWELLING'}
                onClick={() => onSelect(r.id)}
              />
            );
          })}
      </FloorPlanView>

      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap gap-2">
          {(plans.length ?? 0) > 1 && (
            <Select
              value={plan.id}
              onChange={(e) => setPlanId(Number(e.target.value))}
              className="w-44 bg-ink-900/90 py-1 text-xs backdrop-blur"
              aria-label={t('nav.floorPlans')}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          {followChip}
        </div>
      </div>

      <div className="absolute bottom-2 left-2 right-28">{layerButtons}</div>
    </div>
  );
}
