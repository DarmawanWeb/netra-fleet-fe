'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Empty, ErrorNote, Field, PageTitle, Panel, Segmented, Select } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { presetRange, RANGE_PRESETS, useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { PATROL_TONE } from '@/lib/labels';
import { useLive } from '@/lib/live';
import { useMe } from '@/lib/session';

export default function PatrolsPage() {
  const { t, tx, locale } = useI18n();
  const fmt = useFmt();
  const { can } = useMe();
  const { revision } = useLive();
  const [preset, setPreset] = useState<string>('7d');
  const [robotId, setRobotId] = useState('');
  const patrols = useAsync(() => api.patrols.list(presetRange(preset), robotId || undefined), [preset, robotId, revision]);
  const robots = useAsync(() => api.robots.list(), []);
  const routes = useAsync(() => api.routes.list(), [revision]);
  const routeName = (id: number | null) => routes.data?.find((r) => r.id === id)?.name ?? (id ? `#${id}` : '—');

  const [startRobot, setStartRobot] = useState('');
  const [startRoute, setStartRoute] = useState('');
  const [error, setError] = useState<string>();
  const start = async () => {
    setError(undefined);
    try {
      await api.patrols.start(startRobot, Number(startRoute));
      patrols.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('patrols.startFailed'));
    }
  };

  return (
    <>
      <PageTitle
        title={t('patrols.title')}
        subtitle={t('patrols.subtitle')}
        actions={
          <>
            <Segmented value={preset} onChange={setPreset} options={RANGE_PRESETS.map((p) => ({ value: p.key, label: t(p.label) }))} />
            <a
              className="rounded border border-ink-500 px-3 py-1.5 text-sm text-slate-200 hover:border-accent hover:text-accent"
              href={api.reports.patrols(presetRange(preset), locale, robotId || undefined)}
            >
              {t('patrols.exportXlsx')}
            </a>
          </>
        }
      />
      <div className={can('operate') ? 'grid gap-4 xl:grid-cols-[1fr_320px]' : ''}>
        <Panel
          title={t('patrols.history')}
          actions={
            <Select value={robotId} onChange={(e) => setRobotId(e.target.value)} className="w-40">
              <option value="">{t('common.allRobots')}</option>
              {robots.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          }
        >
          <ErrorNote error={patrols.error} />
          {patrols.data?.length ? (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('common.robot')}</th>
                    <th>{t('common.route')}</th>
                    <th>{t('patrols.started')}</th>
                    <th>{t('patrols.duration')}</th>
                    <th>{t('patrols.laps')}</th>
                    <th>{t('common.status')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {patrols.data.map((p) => (
                    <tr key={p.id} className="hover:bg-ink-800">
                      <td>
                        <Link href={`/patrols/${p.id}`} className="text-accent">
                          {p.id}
                        </Link>
                      </td>
                      <td>{p.robot_id}</td>
                      <td>{routeName(p.route_id)}</td>
                      <td>{fmt.dateTime(p.started_at ?? p.created_at)}</td>
                      <td>{fmt.duration(p.started_at, p.finished_at)}</td>
                      <td className="font-mono">{p.laps}</td>
                      <td>
                        <Badge tone={PATROL_TONE[p.status]}>{tx('patrolStatus', p.status)}</Badge>
                        {p.schedule_id && <span className="ml-1 text-[10px] text-slate-500">{t('patrols.scheduled')}</span>}
                      </td>
                      <td className="text-right">
                        <a href={api.reports.patrolPdf(p.id, locale)} className="text-xs text-accent">
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{t('patrols.empty')}</Empty>
          )}
        </Panel>
        {can('operate') && (
          <Panel title={t('patrols.startNow')}>
            <div className="space-y-3">
              <Field label={t('common.robot')}>
                <Select value={startRobot} onChange={(e) => (setStartRobot(e.target.value), setStartRoute(''))}>
                  <option value="">{t('common.selectRobot')}</option>
                  {robots.data?.map((r) => (
                    <option key={r.id} value={r.id} disabled={!r.online}>
                      {r.name}
                      {r.online ? '' : ' (offline)'}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('common.route')}>
                <Select value={startRoute} onChange={(e) => setStartRoute(e.target.value)} disabled={!startRobot}>
                  <option value="">{t('common.selectRoute')}</option>
                  {routes.data
                    ?.filter((r) => r.robot_id === startRobot)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {r.length_m.toFixed(0)} m · {t('routes.stops', { n: r.stops })}
                      </option>
                    ))}
                </Select>
              </Field>
              <ErrorNote error={error} />
              <Button variant="primary" className="w-full" disabled={!startRobot || !startRoute} onClick={start}>
                {t('common.start')}
              </Button>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
