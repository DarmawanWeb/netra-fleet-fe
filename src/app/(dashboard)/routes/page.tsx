'use client';

import { useState } from 'react';
import { FloorPlanView } from '@/components/FloorPlanView';
import { GridMapView } from '@/components/GridMapView';
import { RouteLayer } from '@/components/MapLayers';
import { Badge, Button, Empty, Input, PageTitle, Panel, Toggle, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api, session } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync, useCalibratedPlan } from '@/lib/hooks';
import { useLive } from '@/lib/live';
import { useMe } from '@/lib/session';

async function downloadCsv(id: number, name: string) {
  const res = await fetch(`/api/v1/routes/${id}/file`, { headers: { Authorization: `Bearer ${session.token() ?? ''}` } });
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RoutesPage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const { can } = useMe();
  const { revision } = useLive();
  const [archived, setArchived] = useState(false);
  const routes = useAsync(() => api.routes.list(undefined, archived), [archived, revision]);
  const robots = useAsync(() => api.robots.list(), []);
  const [selected, setSelected] = useState<number>();
  const detail = useAsync(() => (selected ? api.routes.get(selected) : Promise.resolve(undefined)), [selected]);
  const [name, setName] = useState('');
  const { plan, loaded } = useCalibratedPlan(robots.data?.find((r) => r.id === detail.data?.robot_id)?.floor_plan_id);

  const update = async (archive: boolean) => {
    if (!detail.data) return;
    await api.routes.update(detail.data.id, name || detail.data.name, archive);
    routes.reload();
    detail.reload();
  };

  return (
    <>
      <PageTitle
        title={t('routes.title')}
        subtitle={t('routes.subtitle')}
        actions={<Toggle checked={archived} onChange={setArchived} label={t('routes.showArchived')} />}
      />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Panel title={t('nav.routes')}>
          <ul className="max-h-[70vh] space-y-1.5 overflow-y-auto">
            {routes.data?.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => (setSelected(r.id), setName(r.name))}
                  className={cx(
                    'w-full rounded border px-3 py-2 text-left',
                    selected === r.id ? 'border-accent bg-accent/5' : 'border-ink-600 hover:border-ink-500',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-100">{r.name}</span>
                    <span className="text-xs text-slate-500">{r.robot_id}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmt.dateTime(r.recorded_at)} · {r.length_m.toFixed(1)} m · {t('routes.stops', { n: r.stops })}{' '}
                    {r.closed && `· ${t('routes.loop')}`}
                  </div>
                </button>
              </li>
            ))}
            {!routes.data?.length && <Empty>{t('routes.empty')}</Empty>}
          </ul>
        </Panel>
        <div className="space-y-4">
          {detail.data ? (
            <>
              <Panel title={t('routes.details')} actions={detail.data.archived ? <Badge>{t('routes.archived')}</Badge> : null}>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[240px] flex-1">
                    <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!can('configure')} />
                  </div>
                  {can('configure') && (
                    <>
                      <Button variant="primary" onClick={() => update(detail.data!.archived)}>
                        {t('routes.saveName')}
                      </Button>
                      <Button onClick={() => update(!detail.data!.archived)}>
                        {detail.data.archived ? t('routes.restore') : t('routes.archive')}
                      </Button>
                    </>
                  )}
                  <Button onClick={() => downloadCsv(detail.data!.id, detail.data!.name)}>{t('routes.csv')}</Button>
                </div>
              </Panel>
              {plan ? (
                <FloorPlanView plan={plan} className="h-[60vh]">
                  <RouteLayer plan={plan} points={detail.data.points ?? []} />
                </FloorPlanView>
              ) : (
                loaded && (
                  <GridMapView key={detail.data.id} className="h-[60vh]" robots={[]} routes={[detail.data.points ?? []]} anomalies={[]} />
                )
              )}
            </>
          ) : (
            <Panel>
              <Empty>{t('routes.pick')}</Empty>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
