'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { IconThermo, IconWave } from '@/components/icons';
import { PriorityChip } from '@/components/substation/Priority';
import { Badge, Empty, ErrorNote, PageTitle, Panel, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { useMe } from '@/lib/session';
import type { InspectionPoint, Route } from '@/lib/types';
import { useSubstationRevision } from '../_lib/live';

interface Group {
  route?: Route;
  stops: Map<number | null, InspectionPoint[]>;
}

/** Where the robots inspect: the points of each route by stop, in the order the robot takes them. */
export default function PointsPage() {
  const { t } = useI18n();
  const { can } = useMe();
  const rev = useSubstationRevision();
  const points = useAsync(() => api.substation.points(), [rev]);
  const routes = useAsync(async () => {
    const [current, archived] = await Promise.all([api.routes.list(), api.routes.list(undefined, true)]);
    return [...current, ...archived];
  }, []);
  const assets = useAsync(() => api.substation.assets(true), []);
  const tags = useMemo(() => new Map((assets.data ?? []).map((a) => [a.id, a.tag])), [assets.data]);

  const groups = useMemo(() => {
    const byRoute = new Map<number | null, Group>();
    for (const p of points.data ?? []) {
      const g = byRoute.get(p.route_id) ?? { route: routes.data?.find((r) => r.id === p.route_id), stops: new Map() };
      g.stops.set(p.stop_index, [...(g.stops.get(p.stop_index) ?? []), p]);
      byRoute.set(p.route_id, g);
    }
    return [...byRoute.entries()].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a - b));
  }, [points.data, routes.data]);

  return (
    <>
      <PageTitle
        title={t('substation.points.title')}
        subtitle={t('substation.points.subtitle')}
        actions={
          can('configure') && (
            <Link
              href="/substation/points/new"
              className="rounded bg-accent/90 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-accent"
            >
              {t('substation.points.add')}
            </Link>
          )
        }
      />
      <ErrorNote error={points.error} />
      {points.data && !groups.length && (
        <Panel>
          <Empty>{t('substation.points.none')}</Empty>
        </Panel>
      )}
      <div className="space-y-4">
        {groups.map(([routeId, g]) => (
          <Panel
            key={routeId ?? 'none'}
            title={routeId === null ? t('substation.points.noRoute') : (g.route?.name ?? `#${routeId}`)}
            actions={g.route && <span className="text-xs text-slate-400">{g.route.robot_id}</span>}
          >
            <ol className="space-y-4">
              {[...g.stops.entries()]
                .sort(([a], [b]) => (a ?? 1e9) - (b ?? 1e9))
                .map(([stop, list]) => (
                  <li key={stop ?? 'none'} className="grid gap-2 md:grid-cols-[7rem_1fr]">
                    <div className="pt-2 text-xs text-slate-400">
                      {stop === null ? (
                        '—'
                      ) : (
                        <span className="font-semibold text-slate-200">{t('substation.points.stopN', { n: stop + 1 })}</span>
                      )}
                      {list[0]?.stance && (
                        <div className="font-mono text-[11px] text-slate-500">
                          {list[0].stance.x.toFixed(1)}, {list[0].stance.y.toFixed(1)} m
                        </div>
                      )}
                    </div>
                    <ul className="divide-y divide-ink-700 rounded-md border border-ink-600">
                      {list.map((p) => (
                        <PointRow key={p.id} point={p} tag={p.asset_id ? tags.get(p.asset_id) : undefined} />
                      ))}
                    </ul>
                  </li>
                ))}
            </ol>
          </Panel>
        ))}
      </div>
    </>
  );
}

function PointRow({ point: p, tag }: { point: InspectionPoint; tag?: string }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const Icon = p.kind === 'pd' ? IconWave : IconThermo;
  const detail =
    p.kind === 'pd'
      ? t('substation.points.pdSummary')
      : t('substation.points.targetsSummary', { n: p.targets.length, regions: p.targets.filter((x) => x.roi).length });
  return (
    <li>
      <Link
        href={`/substation/points/${p.id}`}
        className={cx('flex items-center gap-3 px-3 py-2.5 transition hover:bg-ink-800/60', !p.enabled && 'opacity-55')}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-ink-700 text-slate-300">
          <Icon width={16} height={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-100">{p.name}</span>
            {tag && <span className="font-mono text-xs text-slate-400">{tag}</span>}
            {!p.enabled && <Badge>{t('substation.points.disabled')}</Badge>}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {detail}
            {p.ptz && ` · ${t('substation.points.ptzSummary', { pan: p.ptz.pan_deg, tilt: p.ptz.tilt_deg, zoom: p.ptz.zoom })}`}
          </span>
        </span>
        <span className="hidden text-right text-xs text-slate-500 sm:block">
          {p.last_inspected ? fmt.ago(p.last_inspected) : t('substation.notInspected')}
        </span>
        {p.last_inspected ? <PriorityChip p={p.priority ?? 0} /> : <span className="w-12" />}
      </Link>
    </li>
  );
}
