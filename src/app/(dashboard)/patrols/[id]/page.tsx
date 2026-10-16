'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FloorPlanView } from '@/components/FloorPlanView';
import { GridMapView } from '@/components/GridMapView';
import { AnomalyPin, RouteLayer } from '@/components/MapLayers';
import { Badge, Button, Empty, ErrorNote, PageTitle, Panel, Stat } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync, useCalibratedPlan, useRules } from '@/lib/hooks';
import { PATROL_TONE } from '@/lib/labels';
import { useLive } from '@/lib/live';
import { useMe } from '@/lib/session';

export default function PatrolDetailPage() {
  const id = Number(useParams<{ id: string }>().id);
  const router = useRouter();
  const { t, tx, locale } = useI18n();
  const fmt = useFmt();
  const { can } = useMe();
  const { revision } = useLive();
  const rules = useRules();
  const detail = useAsync(() => api.patrols.get(id), [id, revision]);
  const events = useAsync(() => api.events(undefined, id), [id, revision]);
  const anomalies = useAsync(() => api.anomalies.list({ patrolId: id }, { from: new Date(0), to: new Date() }), [id, revision]);
  const p = detail.data?.patrol;
  const recap = detail.data?.recap;
  const route = useAsync(() => (p?.route_id ? api.routes.get(p.route_id) : Promise.resolve(undefined)), [p?.route_id]);
  const robots = useAsync(() => api.robots.list(), []);
  const { plan, loaded } = useCalibratedPlan(robots.data?.find((r) => r.id === p?.robot_id)?.floor_plan_id);

  if (!p || !recap) return <ErrorNote error={detail.error} />;
  const total = Object.values(recap.anomalies).reduce((a, b) => a + b, 0);
  const pins = (anomalies.data ?? []).filter((a) => a.x !== null && a.y !== null && a.status !== 'rejected');
  return (
    <>
      <PageTitle
        title={t('patrols.detail', { id: p.id })}
        subtitle={`${p.robot_id} · ${route.data?.name ?? t('common.route')} · ${fmt.dateTime(p.started_at ?? p.created_at)}`}
        actions={
          <>
            <Badge tone={PATROL_TONE[p.status]}>{tx('patrolStatus', p.status)}</Badge>
            <a
              href={api.reports.patrolPdf(p.id, locale)}
              className="rounded border border-ink-500 px-3 py-1.5 text-sm text-slate-200 hover:border-accent hover:text-accent"
            >
              {t('patrols.pdf')}
            </a>
            {can('operate') && (p.status === 'running' || p.status === 'requested') && (
              <Button variant="danger" onClick={() => api.patrols.stop(p.id).then(detail.reload)}>
                {t('common.stop')}
              </Button>
            )}
            <Link href="/patrols" className="text-sm text-accent">
              ← {t('common.back')}
            </Link>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t('patrols.duration')} value={fmt.duration(p.started_at, p.finished_at)} />
        <Stat label={t('patrols.laps')} value={p.laps} />
        <Stat
          label={t('patrols.stopsInspected')}
          value={recap.events.inspected ?? recap.events.arrived ?? 0}
          hint={t('patrols.skipped', { n: recap.events.skipped ?? 0 })}
        />
        <Stat label={t('anomalies.title')} value={total} tone={total ? 'warn' : undefined} />
        <Stat label={t('patrols.crowdPeak')} value={recap.crowd_peak} hint={t('patrols.inView')} />
      </div>
      {p.message && <div className="mb-4 text-sm text-slate-400">{t('patrols.note', { text: p.message })}</div>}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {plan ? (
            <FloorPlanView plan={plan} className="h-[460px]">
              {route.data?.points && <RouteLayer plan={plan} points={route.data.points} />}
              {pins.map((a) => (
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
            </FloorPlanView>
          ) : (
            loaded && (
              <GridMapView
                className="h-[460px]"
                robots={[]}
                routes={route.data?.points ? [route.data.points] : []}
                anomalies={pins.map((a) => ({
                  id: a.id,
                  x: a.x!,
                  y: a.y!,
                  pending: a.status === 'needs_validation',
                  label: rules.label(a.final_category ?? a.early_category),
                }))}
                onAnomaly={(aid) => router.push(`/anomalies/${aid}`)}
              />
            )
          )}
          <Panel title={t('patrols.byCategory')}>
            {total ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(recap.anomalies).map(([c, n]) => (
                  <span key={c} className="rounded border border-ink-500 px-3 py-1.5 text-sm text-slate-200">
                    {rules.label(c)} <b className="ml-1 font-mono text-warn">{n}</b>
                  </span>
                ))}
              </div>
            ) : (
              <Empty>{t('patrols.noAnomalies')}</Empty>
            )}
          </Panel>
        </div>
        <Panel title={t('patrols.timeline')}>
          <ul className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
            {(events.data ?? []).map((e) => {
              const ev = String(e.payload.event ?? '');
              const text =
                e.type === 'alert'
                  ? t('patrols.alertPrefix', { state: tx('navState', String(e.payload.state)) })
                  : e.type === 'stop_event'
                    ? `${tx('event', ev)} #${Number(e.payload.index) + 1}`
                    : tx('event', ev || e.type);
              return (
                <li
                  key={e.id}
                  className={`border-l-2 pl-3 text-sm text-slate-200 ${e.type === 'alert' ? 'border-danger' : 'border-ink-500'}`}
                >
                  <span className="font-mono text-xs text-slate-500">{fmt.timeSec(e.ts)}</span> {text}
                </li>
              );
            })}
            {!events.data?.length && <Empty>{t('patrols.noEvents')}</Empty>}
          </ul>
        </Panel>
      </div>
    </>
  );
}
