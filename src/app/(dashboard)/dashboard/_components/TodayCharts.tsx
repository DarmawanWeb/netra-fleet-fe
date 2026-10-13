'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/format';
import { PATROL_TONE, type Tone } from '@/lib/labels';
import type { Anomaly, Patrol, PatrolStatus, Robot, Route, TimelinePoint } from '@/lib/types';
import { isFinding } from '../_lib/overview';
import { ChartTooltip, SrTable, useWidth, type Tip } from './chart';

const TONE_FILL: Record<Tone, string> = {
  ok: 'rgb(var(--ok))',
  warn: 'rgb(var(--warn))',
  danger: 'rgb(var(--danger))',
  info: 'rgb(var(--accent))',
  muted: 'rgb(var(--slate-500))',
};
const STATUS_ORDER: PatrolStatus[] = ['running', 'finished', 'stopped', 'failed', 'requested'];

/**
 * The part of today worth drawing: from the earliest activity (at most six hours before now, so a
 * quiet morning still shows context) to just after now, on whole hours.
 */
function dayWindow(activityMinutes: number[], nowMin: number) {
  const first = Math.min(nowMin - 360, ...activityMinutes);
  const from = Math.max(0, Math.floor(first / 60) * 60);
  const to = Math.min(1440, Math.max(from + 360, Math.ceil((nowMin + 30) / 60) * 60));
  const hours = (to - from) / 60;
  const step = hours <= 6 ? 1 : hours <= 12 ? 2 : 3;
  const ticks: number[] = [];
  for (let m = from; m <= to; m += step * 60) ticks.push(m);
  return { from, to, ticks };
}

const hhmm = (minute: number) => `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:00`;

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('flex min-w-0 flex-col bg-ink-900 px-4 pb-3 pt-2.5', className)}>
      <h2 className="mb-2 text-[13px] font-semibold text-slate-200">{title}</h2>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

const Quiet = ({ children }: { children: React.ReactNode }) => <div className="pt-6 text-center text-xs text-slate-500">{children}</div>;

/** Today's patrols on a time axis, one lane per robot (name above it), coloured by status. */
function PatrolTimeline({ patrols, robots, routes }: { patrols: Patrol[]; robots: Robot[]; routes: Route[] }) {
  const router = useRouter();
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const now = new Date();
  const nowMin = fmt.minuteOfDay(now);

  const lanes = useMemo(() => {
    const ids = [...new Set(patrols.map((p) => p.robot_id))];
    const order = robots.map((r) => r.id);
    return ids.sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999));
  }, [patrols, robots]);

  if (!patrols.length) return <Quiet>{t('dashboard.noPatrolToday')}</Quiet>;

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const minuteOf = (iso: string) => (new Date(iso).getTime() < startOfDay ? 0 : fmt.minuteOfDay(iso));
  const win = dayWindow(
    patrols.map((p) => minuteOf(p.started_at ?? p.created_at)),
    nowMin,
  );
  const left = 2;
  const right = 18;
  const top = 14;
  const laneH = 30;
  const axisH = 16;
  const height = top + lanes.length * laneH + axisH;
  const plotW = Math.max(10, width - left - right);
  const x = (min: number) => left + ((Math.min(win.to, Math.max(win.from, min)) - win.from) / (win.to - win.from)) * plotW;
  const routeName = (id: number | null) => routes.find((r) => r.id === id)?.name ?? (id ? `#${id}` : '—');
  const robotName = (id: string) => robots.find((r) => r.id === id)?.name ?? id;
  const statuses = STATUS_ORDER.filter((st) => patrols.some((p) => p.status === st));

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={t('dashboard.timeline')} onMouseLeave={() => setTip(null)}>
          {win.ticks.map((m) => (
            <g key={m}>
              <line x1={x(m)} x2={x(m)} y1={top} y2={height - axisH} stroke="rgb(var(--ink-700))" />
              <text
                x={x(m)}
                y={height - 4}
                textAnchor={m === win.from ? 'start' : m === win.to ? 'end' : 'middle'}
                fontSize={10}
                className="fill-slate-500 tabular-nums"
              >
                {plotW < 320 ? String(Math.floor(m / 60) % 24).padStart(2, '0') : hhmm(m)}
              </text>
            </g>
          ))}
          {lanes.map((robotId, lane) => {
            const y = top + lane * laneH;
            return (
              <g key={robotId}>
                <text x={left} y={y + 10} fontSize={10} className="fill-slate-400">
                  {robotName(robotId)}
                </text>
                {patrols
                  .filter((p) => p.robot_id === robotId)
                  .map((p) => {
                    const startIso = p.started_at ?? p.created_at;
                    const live = p.status === 'running' || p.status === 'requested';
                    const m0 = minuteOf(startIso);
                    const m1 = p.finished_at ? minuteOf(p.finished_at) : live ? nowMin : m0 + 1;
                    const x0 = x(m0);
                    const w = Math.max(4, x(m1) - x0);
                    const fill = TONE_FILL[PATROL_TONE[p.status]];
                    const label = `${fmt.time(startIso)}–${p.finished_at ? fmt.time(p.finished_at) : live ? t('dashboard.now') : '?'}, ${tx('patrolStatus', p.status)}, ${t('dashboard.laps', { n: p.laps })}`;
                    return (
                      <g
                        key={p.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/patrols/${p.id}`)}
                        onMouseMove={() =>
                          setTip({ x: x0 + w / 2, y: y + 12, value: `#${p.id} ${routeName(p.route_id)}`, label, color: fill })
                        }
                      >
                        <rect x={x0 - 4} y={y + 10} width={w + 8} height={laneH - 10} fill="transparent" />
                        <rect x={x0} y={y + 15} width={w} height={10} rx={3} fill={fill} />
                      </g>
                    );
                  })}
              </g>
            );
          })}
          <line x1={x(nowMin)} x2={x(nowMin)} y1={top - 4} y2={height - axisH} stroke="rgb(var(--accent))" strokeWidth={1.5} />
        </svg>
      )}
      <ChartTooltip tip={tip} width={width} />
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
        {statuses.map((st) => (
          <span key={st} className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ background: TONE_FILL[PATROL_TONE[st]] }} />
            {tx('patrolStatus', st)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-accent" />
          {t('dashboard.now')}
        </span>
      </div>
      <SrTable
        caption={t('dashboard.timeline')}
        head={['#', t('common.robot'), t('common.route'), t('common.status'), t('patrols.started')]}
        rows={patrols.map((p) => [
          p.id,
          robotName(p.robot_id),
          routeName(p.route_id),
          tx('patrolStatus', p.status),
          fmt.time(p.started_at ?? p.created_at),
        ])}
      />
    </div>
  );
}

/** Findings of today per category: one series, value at the bar tip. */
function CategoryBars({ anomalies, label }: { anomalies: Anomaly[]; label: (c: string) => string }) {
  const { t, tx } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const rows = useMemo(() => {
    const counts = new Map<string, { total: number; byStatus: Record<string, number> }>();
    for (const a of anomalies.filter(isFinding)) {
      const key = a.final_category ?? a.early_category;
      const row = counts.get(key) ?? { total: 0, byStatus: {} };
      row.total += 1;
      row.byStatus[a.status] = (row.byStatus[a.status] ?? 0) + 1;
      counts.set(key, row);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1].total - a[1].total);
    if (sorted.length <= 5) return sorted;
    const other = sorted.slice(4).reduce((acc, [, r]) => ({ total: acc.total + r.total, byStatus: {} }), { total: 0, byStatus: {} });
    return [...sorted.slice(0, 4), ['unknown', other] as [string, typeof other]];
  }, [anomalies]);

  if (!rows.length) return <Quiet>{t('dashboard.noAnomaliesToday')}</Quiet>;
  const max = Math.max(...rows.map(([, r]) => r.total));
  return (
    <div ref={ref} className="relative space-y-1.5" onMouseLeave={() => setTip(null)}>
      {rows.map(([category, r]) => (
        <div
          key={category}
          className="grid grid-cols-[minmax(0,42%)_1fr] items-center gap-2 rounded px-1 py-0.5 hover:bg-ink-800"
          onMouseMove={(e) =>
            setTip({
              x: width / 2,
              y: e.currentTarget.offsetTop,
              value: `${r.total} ${label(category)}`,
              label: Object.entries(r.byStatus)
                .map(([s, n]) => `${n} ${tx('anomalyStatus', s).toLowerCase()}`)
                .join(', '),
              color: 'rgb(var(--accent))',
            })
          }
        >
          <span className="truncate text-xs text-slate-300">{label(category)}</span>
          <span className="flex items-center gap-2">
            <span className="h-2 rounded-r-[4px] bg-accent" style={{ width: `${Math.max(4, (r.total / max) * 85)}%` }} />
            <span className="text-xs font-semibold tabular-nums text-slate-200">{r.total}</span>
          </span>
        </div>
      ))}
      <ChartTooltip tip={tip} width={width} />
      <SrTable
        caption={t('dashboard.byCategory')}
        head={[t('settings.category'), t('dashboard.anomaliesToday')]}
        rows={rows.map(([c, r]) => [label(c), r.total])}
      />
    </div>
  );
}

/** Peak people per hour today; the current hour is the emphasised column. */
function CrowdColumns({ points }: { points: TimelinePoint[] }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const byHour = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of points) m.set(fmt.hourOfDay(p.bucket), Math.max(m.get(fmt.hourOfDay(p.bucket)) ?? 0, p.peak));
    return m;
  }, [points, fmt]);

  if (!byHour.size) return <Quiet>{t('crowd.noData')}</Quiet>;
  const nowMin = fmt.minuteOfDay(new Date());
  const nowHour = Math.floor(nowMin / 60);
  const win = dayWindow(
    [...byHour.keys()].map((h) => h * 60),
    nowMin,
  );
  const firstHour = win.from / 60;
  const hours = Math.max(1, (win.to - win.from) / 60);
  const peak = Math.max(...byHour.values());
  const ceil = Math.max(2, Math.ceil(peak / 2) * 2);
  const gutter = 22;
  const top = 16;
  const axisH = 16;
  const plotH = 84;
  const height = top + plotH + axisH;
  const step = Math.max(1, (width - gutter - 4) / hours);
  const colW = Math.min(16, step * 0.62);
  const y = (v: number) => top + plotH - (v / ceil) * plotH;
  const peakHour = [...byHour.entries()].find(([, v]) => v === peak)?.[0];
  const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={t('dashboard.crowdByHour')} onMouseLeave={() => setTip(null)}>
          {[0, ceil / 2, ceil].map((v) => (
            <g key={v}>
              <line x1={gutter} x2={width} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'rgb(var(--ink-500))' : 'rgb(var(--ink-700))'} />
              <text x={gutter - 5} y={y(v) + 3.5} textAnchor="end" fontSize={10} className="fill-slate-500 tabular-nums">
                {v}
              </text>
            </g>
          ))}
          {win.ticks
            .filter((m) => m < win.to)
            .map((m) => (
              <text
                key={m}
                x={gutter + (m / 60 - firstHour) * step + step / 2}
                y={height - 3}
                textAnchor="middle"
                fontSize={10}
                className="fill-slate-500 tabular-nums"
              >
                {String(m / 60).padStart(2, '0')}
              </text>
            ))}
          {Array.from({ length: hours }, (_, i) => {
            const h = firstHour + i;
            const v = byHour.get(h);
            if (v === undefined) return null;
            const cx = gutter + i * step + (step - colW) / 2;
            const current = h === nowHour;
            return (
              <g
                key={h}
                onMouseMove={() =>
                  setTip({
                    x: cx + colW / 2,
                    y: y(v),
                    value: t('dashboard.peakPeople', { n: v }),
                    label: t('dashboard.hourRange', { from: hh(h), to: hh((h + 1) % 24) }),
                    color: 'rgb(var(--accent))',
                  })
                }
              >
                <rect x={gutter + i * step} y={top} width={step} height={plotH} fill="transparent" />
                <path
                  d={`M${cx},${y(0)} V${Math.min(y(v) + 4, y(0))} Q${cx},${y(v)} ${cx + 4},${y(v)} H${cx + colW - 4} Q${cx + colW},${y(v)} ${cx + colW},${Math.min(y(v) + 4, y(0))} V${y(0)} Z`}
                  fill="rgb(var(--accent))"
                  fillOpacity={current ? 1 : 0.5}
                />
                {h === peakHour && (
                  <text
                    x={cx + colW / 2}
                    y={y(v) - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    className="fill-slate-200 tabular-nums"
                  >
                    {v}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <ChartTooltip tip={tip} width={width} />
      <SrTable
        caption={t('dashboard.crowdByHour')}
        head={[t('common.time'), t('crowd.peak')]}
        rows={[...byHour.entries()].sort((a, b) => a[0] - b[0]).map(([h, v]) => [hh(h), v])}
      />
    </div>
  );
}

/** The "today" band under the map: patrol timeline, findings by category, crowd by hour. */
export function TodayCharts({
  patrols,
  robots,
  routes,
  anomalies,
  crowd,
  label,
}: {
  patrols: Patrol[];
  robots: Robot[];
  routes: Route[];
  anomalies: Anomaly[];
  crowd: TimelinePoint[];
  label: (c: string) => string;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-ink-600 bg-ink-600 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr]">
      <Section title={t('dashboard.timeline')} className="md:col-span-2 xl:col-span-1">
        <PatrolTimeline patrols={patrols} robots={robots} routes={routes} />
      </Section>
      <Section title={t('dashboard.byCategory')}>
        <CategoryBars anomalies={anomalies} label={label} />
      </Section>
      <Section title={t('dashboard.crowdByHour')}>
        <CrowdColumns points={crowd} />
      </Section>
    </div>
  );
}
