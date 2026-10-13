'use client';

import { useMemo, useState } from 'react';
import { ErrorNote } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync, useRules } from '@/lib/hooks';
import { useLive } from '@/lib/live';
import { Activity } from './_components/Activity';
import { Attention } from './_components/Attention';
import { Fleet } from './_components/Fleet';
import { LiveMap, type Layer } from './_components/LiveMap';
import { Readouts, type Readout } from './_components/Readouts';
import { TodayCharts } from './_components/TodayCharts';
import { robotIssues } from './_lib/attention';
import { isFinding, useFreshAnomalies, useOverview, usePatrolProgress, useRoutePoints, useTrails } from './_lib/overview';

const LAYERS_KEY = 'netra.dashboard.layers';
const DEFAULT_LAYERS: Record<Layer, boolean> = { robots: true, trails: true, routes: true, anomalies: true, crowd: false };

/** Map layer switches, remembered per browser. */
function useLayers() {
  const [layers, setLayers] = useState<Record<Layer, boolean>>(() => {
    try {
      return { ...DEFAULT_LAYERS, ...(JSON.parse(localStorage.getItem(LAYERS_KEY) ?? '{}') as Partial<Record<Layer, boolean>>) };
    } catch {
      return DEFAULT_LAYERS;
    }
  });
  const update = (next: Record<Layer, boolean>) => {
    setLayers(next);
    try {
      localStorage.setItem(LAYERS_KEY, JSON.stringify(next));
    } catch {
      /* not remembered in private mode */
    }
  };
  return [layers, update] as const;
}

/**
 * The command center at a glance: situation figures, the live map, everything that needs a
 * person, the fleet with its controls, the activity log and today's patrols, findings and crowd.
 * On a wide screen it fills the window without scrolling (wall display); narrower, it stacks.
 */
export default function DashboardPage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const { telemetry, online } = useLive();
  const rules = useRules();
  const o = useOverview();
  const [layers, setLayers] = useLayers();
  const [selected, setSelected] = useState<string>();
  const [follow, setFollow] = useState(false);

  const onlineIds = o.robots.filter((r) => online[r.id] ?? r.online).map((r) => r.id);
  const trails = useTrails(onlineIds);
  const progress = usePatrolProgress(telemetry);
  const fresh = useFreshAnomalies();
  const heat = useAsync(
    () => (layers.crowd ? api.crowd.heatmap({ from: new Date(Date.now() - 3600e3), to: new Date() }) : Promise.resolve([])),
    [layers.crowd, o.crowd],
  );
  const routePoints = useRoutePoints([
    ...Object.values(telemetry).map((tel) => tel.patrol?.route_id),
    ...o.events.slice(0, 200).map((e) => Number(e.payload.route_id) || null),
    ...o.pending.map((a) => a.route_id),
  ]);

  const select = (id: string) => {
    if (selected === id) {
      setSelected(undefined);
      setFollow(false);
    } else {
      setSelected(id);
      setFollow(true);
    }
  };

  const issues = useMemo(() => robotIssues(o.robots, telemetry, online, o.patrols), [o.robots, telemetry, online, o.patrols]);

  const readouts = useMemo<Readout[]>(() => {
    const onlineRobots = o.robots.filter((r) => online[r.id] ?? r.online);
    const onPatrol = onlineRobots.filter((r) => (telemetry[r.id] ?? r.last_telemetry)?.patrol?.patrol_id).length;
    const now = Date.now();
    const patrolMs = o.patrols.reduce((sum, p) => {
      if (!p.started_at) return sum;
      const end = p.finished_at ? new Date(p.finished_at).getTime() : p.status === 'running' ? now : new Date(p.started_at).getTime();
      return sum + Math.max(0, end - new Date(p.started_at).getTime());
    }, 0);
    const oldest = [...o.pending].sort((a, b) => a.detected_at.localeCompare(b.detected_at))[0];
    const findings = o.anomaliesToday.filter(isFinding);
    const confirmed = o.anomaliesToday.filter((a) => a.status === 'confirmed').length;
    const rejected = o.anomaliesToday.length - findings.length;
    const peopleNow = onlineRobots.reduce((sum, r) => sum + (telemetry[r.id]?.people ?? 0), 0);
    const peak = o.crowd.reduce<{ peak: number; bucket: string } | null>((m, p) => (!m || p.peak > m.peak ? p : m), null);
    return [
      {
        key: 'robots',
        label: t('dashboard.robotsOnline'),
        value: onlineRobots.length,
        suffix: t('dashboard.ofTotal', { n: o.robots.length }),
        hint: onPatrol ? t('dashboard.onPatrol', { n: onPatrol }) : t('dashboard.noneOnPatrol'),
        tone: issues.some((i) => i.severity === 'critical') ? 'danger' : undefined,
      },
      {
        key: 'patrols',
        label: t('dashboard.patrolsToday'),
        value: o.patrols.length,
        hint: patrolMs > 0 ? t('dashboard.patrolTime', { time: fmt.span(patrolMs) }) : t('dashboard.noPatrolYet'),
      },
      {
        key: 'awaiting',
        label: t('dashboard.awaiting'),
        value: o.pending.length,
        hint: oldest ? t('dashboard.oldest', { ago: fmt.ago(oldest.detected_at) }) : t('dashboard.nothingToReview'),
        tone: o.pending.length ? 'warn' : undefined,
      },
      {
        key: 'anomalies',
        label: t('dashboard.anomaliesToday'),
        value: findings.length,
        hint: t('dashboard.anomalySplit', { confirmed, rejected }),
      },
      {
        key: 'people',
        label: t('dashboard.peopleInView'),
        value: peopleNow,
        hint: peak ? t('dashboard.peakToday', { n: peak.peak, time: fmt.time(peak.bucket) }) : t('dashboard.noCrowdYet'),
      },
    ];
  }, [o.robots, o.patrols, o.pending, o.anomaliesToday, o.crowd, online, telemetry, issues, t, fmt]);

  return (
    <div className="flex flex-col gap-2 sm:gap-3 wall:grid wall:h-[calc(100dvh-3.0625rem-1.5rem)] wall:grid-cols-[minmax(0,1fr)_minmax(22rem,25rem)] wall:grid-rows-[auto_minmax(0,1fr)_auto]">
      <h1 className="sr-only">{t('dashboard.title')}</h1>
      <div className="space-y-2 wall:col-span-2">
        <div className="overflow-hidden rounded-xl border border-ink-600">
          <Readouts items={readouts} />
        </div>
        <ErrorNote error={o.error} />
      </div>

      <section
        aria-label={t('dashboard.liveMap')}
        className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-950 wall:col-start-1 wall:row-start-2"
      >
        <LiveMap
          className="aspect-[16/10] max-h-[62vh] min-h-[260px] wall:aspect-auto wall:max-h-none wall:min-h-0 wall:flex-1"
          plans={o.plans}
          robots={o.robots}
          telemetry={telemetry}
          online={online}
          trails={trails}
          routePoints={routePoints}
          anomalies={o.anomalies24h.filter(isFinding)}
          fresh={fresh}
          heat={heat.data ?? []}
          layers={layers}
          onLayers={setLayers}
          selected={selected}
          follow={follow}
          onSelect={select}
          onFollow={setFollow}
          label={rules.label}
        />
      </section>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-900 wall:col-start-2 wall:row-span-2 wall:row-start-2">
        <div className="flex shrink-0 flex-col border-b border-ink-600 wall:max-h-[42%] wall:min-h-0">
          <Attention issues={issues} pending={o.pending} robots={o.robots} routePoints={routePoints} label={rules.label} />
        </div>
        <div className="shrink-0 border-b border-ink-600 wall:max-h-[42%] wall:overflow-y-auto">
          <Fleet
            robots={o.robots}
            telemetry={telemetry}
            online={online}
            patrols={o.patrols}
            routes={o.routes}
            routePoints={routePoints}
            progress={progress}
            selected={selected}
            onSelect={select}
            publicUrl={o.publicUrl}
          />
        </div>
        <div className="flex max-h-96 min-h-[12rem] flex-1 flex-col wall:max-h-none wall:min-h-0">
          <Activity events={o.events} anomalies={o.anomaliesToday} robots={o.robots} routePoints={routePoints} label={rules.label} />
        </div>
      </aside>

      <div className="wall:col-start-1 wall:row-start-3">
        <TodayCharts
          patrols={o.patrols}
          robots={o.robots}
          routes={o.routes}
          anomalies={o.anomaliesToday}
          crowd={o.crowd}
          label={rules.label}
        />
      </div>
    </div>
  );
}
