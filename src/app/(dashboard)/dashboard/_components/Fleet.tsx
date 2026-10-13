'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IconCrosshair, IconOctagon } from '@/components/icons';
import { Badge, Button, Select, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { batteryTone, fieldTone, healthTone, navTone, type Tone } from '@/lib/labels';
import { useMe } from '@/lib/session';
import type { Patrol, Robot, RobotCommand, Route, RoutePoint, Telemetry } from '@/lib/types';
import { stopOrdinal } from '../_lib/stops';

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-accent',
  muted: 'text-slate-400',
};
const TONE_BG: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', info: 'bg-accent', muted: 'bg-slate-500' };

function Meter({ label, value, tone, fill }: { label: string; value: string; tone: Tone; fill?: number | null }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] text-slate-500">{label}</div>
      <div className={cx('truncate text-sm font-medium', tone === 'muted' ? 'text-slate-300' : TONE_TEXT[tone])}>{value}</div>
      {fill !== undefined && (
        <div className="mt-1 h-1 rounded-full bg-ink-700">
          {fill !== null && (
            <div className={cx('h-1 rounded-full', TONE_BG[tone])} style={{ width: `${Math.max(3, Math.min(100, fill))}%` }} />
          )}
        </div>
      )}
    </div>
  );
}

function RobotRow({
  robot,
  tel,
  online,
  patrol,
  routes,
  points,
  stopIndex,
  selected,
  onSelect,
}: {
  robot: Robot;
  tel: Telemetry | null;
  online: boolean;
  patrol?: Patrol;
  routes: Route[];
  points?: RoutePoint[];
  stopIndex?: number | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const { can } = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string>();
  const [routeId, setRouteId] = useState('');
  const patrolId = tel?.patrol?.patrol_id ?? null;
  const route = routes.find((r) => r.id === (tel?.patrol?.route_id ?? patrol?.route_id));
  const ord = stopOrdinal(points, stopIndex);
  const battery = tel?.battery?.pct ?? null;
  const operate = online && can('operate');
  const own = routes.filter((r) => r.robot_id === robot.id && !r.archived);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setNote(undefined);
    try {
      await fn();
      setNote(t('robot.commandSent'));
    } catch (e) {
      setNote(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(null);
    }
  };
  const send = (name: RobotCommand) => run(name, () => api.robots.command(robot.id, name));
  const details = (
    <Link href={`/robots/${robot.id}`} className="ml-auto shrink-0 text-xs text-slate-400 hover:text-accent">
      {t('robot.details')}
    </Link>
  );

  return (
    <article className={cx('px-4 py-3', selected && 'bg-accent/5', !online && 'opacity-70')}>
      <div className="flex items-center justify-between gap-2">
        <button onClick={onSelect} className="group flex min-w-0 items-center gap-2 text-left" aria-pressed={selected}>
          <span className={cx('h-2 w-2 shrink-0 rounded-full', online ? 'bg-ok' : 'bg-slate-600')} />
          <span className="truncate font-medium text-slate-100 group-hover:text-accent">{robot.name}</span>
          {online && (
            <IconCrosshair
              width={14}
              height={14}
              className={cx('shrink-0', selected ? 'text-accent' : 'text-slate-500 group-hover:text-accent')}
              aria-label={selected ? t('dashboard.stopFollowing') : t('dashboard.follow', { name: robot.name })}
            />
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {online && tel?.mode === 'remote' && <Badge tone="info">{t('robot.remote')}</Badge>}
          <Badge tone={online ? (tel?.estop ? 'danger' : navTone(tel?.nav.state)) : 'muted'}>
            {online ? (tel?.estop ? t('dashboard.estopEngaged') : tx('navState', tel?.nav.state)) : 'Offline'}
          </Badge>
        </div>
      </div>

      {online ? (
        <>
          <div className="mt-2 text-xs text-slate-400">
            {patrolId ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="truncate text-slate-300">{route?.name ?? `#${tel?.patrol?.route_id}`}</span>
                  <span className="shrink-0 tabular-nums">
                    {ord ? t('dashboard.stopOf', { n: ord.n, total: ord.total }) : t('dashboard.patrolling')}
                    {patrol ? `, ${t('dashboard.lap', { n: patrol.laps + 1 })}` : ''}
                  </span>
                </div>
                {ord && (
                  <div className="mt-1 h-1 rounded-full bg-ink-700">
                    <div className="h-1 rounded-full bg-accent" style={{ width: `${Math.max(3, (ord.n / ord.total) * 100)}%` }} />
                  </div>
                )}
              </>
            ) : (
              <span className="truncate">{tel?.mission || tel?.nav.message || t('dashboard.idle')}</span>
            )}
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-3">
            <Meter
              label={t('robot.battery')}
              value={battery === null ? '—' : `${Math.round(battery)}%`}
              tone={batteryTone(battery)}
              fill={battery}
            />
            <Meter label={t('robot.people')} value={String(tel?.people ?? 0)} tone="muted" />
            <Meter
              label={t('dashboard.field')}
              value={tel?.field ? tx('dashboard.fieldState', tel.field) : '—'}
              tone={fieldTone(tel?.field)}
            />
            <div title={tel?.health?.issues.join('\n')}>
              <Meter
                label={t('robot.health')}
                value={tel?.health ? (tel.health.ok ? t('robot.healthy') : t('robot.issues', { n: tel.health.issues.length })) : '—'}
                tone={healthTone(tel?.health)}
              />
            </div>
          </div>
          {operate && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {tel?.estop ? (
                <Button
                  className="px-2.5 py-1 text-xs"
                  disabled={!!busy}
                  onClick={() => confirm(t('dashboard.confirmRelease', { name: robot.name })) && send('estop_release')}
                >
                  {t('dashboard.release')}
                </Button>
              ) : (
                <Button
                  variant="danger"
                  className="flex items-center gap-1 px-2.5 py-1 text-xs"
                  title={t('dashboard.estopTitle', { name: robot.name })}
                  disabled={busy === 'estop'}
                  onClick={() => send('estop')}
                >
                  <IconOctagon width={14} height={14} aria-hidden />
                  {t('dashboard.estop')}
                </Button>
              )}
              {patrolId ? (
                <>
                  {tel?.nav.state === 'PAUSED' ? (
                    <Button className="px-2.5 py-1 text-xs" disabled={!!busy} onClick={() => send('resume')}>
                      {t('robot.resume')}
                    </Button>
                  ) : (
                    <Button className="px-2.5 py-1 text-xs" disabled={!!busy} onClick={() => send('pause')}>
                      {t('robot.pause')}
                    </Button>
                  )}
                  <Button
                    className="px-2.5 py-1 text-xs"
                    disabled={!!busy}
                    onClick={() => confirm(t('robot.confirmStop', { name: robot.name })) && send('stop_patrol')}
                  >
                    {t('robot.stopPatrol')}
                  </Button>
                </>
              ) : own.length ? (
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Select
                    value={routeId}
                    onChange={(e) => setRouteId(e.target.value)}
                    className="min-w-0 flex-1 py-1 text-xs"
                    aria-label={t('common.selectRoute')}
                  >
                    <option value="">{t('common.selectRoute')}</option>
                    {own.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="primary"
                    className="shrink-0 px-2.5 py-1 text-xs"
                    disabled={!routeId || !!busy}
                    onClick={() => run('start', () => api.patrols.start(robot.id, Number(routeId)))}
                  >
                    {t('dashboard.startPatrol')}
                  </Button>
                </span>
              ) : (
                <span className="text-xs text-slate-500">{t('dashboard.noRoutes')}</span>
              )}
              {patrolId && (
                <Button className="px-2.5 py-1 text-xs" disabled={!!busy} onClick={() => send('localize')}>
                  {t('robot.localize')}
                </Button>
              )}
              {details}
            </div>
          )}
          {!operate && <div className="mt-2 flex justify-end">{details}</div>}
          {note && <div className="mt-1.5 text-xs text-slate-400">{note}</div>}
        </>
      ) : (
        <div className="mt-1 flex justify-between gap-2 text-xs text-slate-500">
          {t('robot.lastSeen', { ago: fmt.ago(robot.last_seen) })}
          {details}
        </div>
      )}
    </article>
  );
}

/** Every robot with its live state, patrol progress and the commands an operator needs. */
export function Fleet({
  robots,
  telemetry,
  online,
  patrols,
  routes,
  routePoints,
  progress,
  selected,
  onSelect,
  publicUrl,
}: {
  robots: Robot[];
  telemetry: Record<string, Telemetry>;
  online: Record<string, boolean>;
  patrols: Patrol[];
  routes: Route[];
  routePoints: Record<number, RoutePoint[]>;
  progress: Record<number, { stopIndex: number | null }>;
  selected?: string;
  onSelect: (id: string) => void;
  publicUrl: string;
}) {
  const { t } = useI18n();
  const sorted = [...robots].sort((a, b) => Number(online[b.id] ?? b.online) - Number(online[a.id] ?? a.online));
  return (
    <section aria-labelledby="fleet-title">
      <header className="flex items-center justify-between px-4 pb-1 pt-3">
        <h2 id="fleet-title" className="text-[13px] font-semibold text-slate-200">
          {t('map.fleet')}
        </h2>
      </header>
      {sorted.length ? (
        <div className="divide-y divide-ink-700">
          {sorted.map((r) => {
            const tel = telemetry[r.id] ?? r.last_telemetry;
            const patrolId = tel?.patrol?.patrol_id ?? null;
            return (
              <RobotRow
                key={r.id}
                robot={r}
                tel={tel}
                online={online[r.id] ?? r.online}
                patrol={patrols.find((p) => p.id === patrolId)}
                routes={routes}
                points={tel?.patrol?.route_id ? routePoints[tel.patrol.route_id] : undefined}
                stopIndex={patrolId ? progress[patrolId]?.stopIndex : null}
                selected={selected === r.id}
                onSelect={() => onSelect(r.id)}
              />
            );
          })}
        </div>
      ) : (
        <p className="px-4 pb-3 text-xs text-slate-500">
          {t('map.noRobots')} {publicUrl && t('dashboard.connectHint', { url: publicUrl })}
        </p>
      )}
    </section>
  );
}
