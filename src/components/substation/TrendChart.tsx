'use client';

import { useMemo, useState } from 'react';
import { ChartTooltip, SrTable, useWidth, type Tip } from '@/app/(dashboard)/dashboard/_components/chart';
import { cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/format';
import { SERIES, priorityColor } from '@/lib/substation';
import type { Priority, Trend } from '@/lib/types';

const PAD = { top: 12, right: 12, bottom: 22, left: 40 };

/**
 * Readings of one point over time: a line per target (°C, or dB for partial discharge), the
 * ambient air dashed, and under the plot a strip with each capture's rating. With `highlight`, that
 * target is drawn in `highlightColor` and the others recede.
 */
export function TrendChart({
  trend,
  highlight,
  highlightColor,
  height = 220,
}: {
  trend: Trend;
  highlight?: string;
  highlightColor?: string;
  height?: number;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const unit = trend.kind === 'pd' ? 'dB' : '°C';
  // The air temperature belongs on a thermal point's chart only, not on a scale of decibels.
  const samples = useMemo(
    () => (trend.kind === 'pd' ? trend.samples.map((s) => ({ ...s, ambient_c: null })) : trend.samples),
    [trend.kind, trend.samples],
  );

  const geo = useMemo(() => {
    if (!samples.length || width < 80) return null;
    const times = samples.map((s) => new Date(s.taken_at).getTime());
    const t0 = Math.min(...times);
    const t1 = Math.max(...times, t0 + 60_000);
    const values = samples.flatMap((s) => [...Object.values(s.values), ...(s.ambient_c !== null ? [s.ambient_c] : [])]);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const span = Math.max(4, hi - lo);
    lo = Math.floor(lo - span * 0.12);
    hi = Math.ceil(hi + span * 0.12);
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom - 10;
    const x = (ms: number) => PAD.left + ((ms - t0) / (t1 - t0)) * plotW;
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;
    const step = Math.max(1, Math.round((hi - lo) / 4));
    const ticks: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    return { times, t0, t1, x, y, ticks, plotH, plotW };
  }, [samples, width, height]);

  const colorOf = (key: string, i: number) => {
    if (highlight) return key === highlight ? (highlightColor ?? priorityColor(1)) : 'rgb(var(--slate-500))';
    return SERIES[i % SERIES.length];
  };

  const line = (key: string) =>
    geo
      ? samples
          .map((s, i) => (s.values[key] === undefined ? null : `${geo.x(geo.times[i]!)},${geo.y(s.values[key]!)}`))
          .filter(Boolean)
          .join(' ')
      : '';
  const ambient = geo
    ? samples
        .map((s, i) => (s.ambient_c === null ? null : `${geo.x(geo.times[i]!)},${geo.y(s.ambient_c)}`))
        .filter(Boolean)
        .join(' ')
    : '';

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    let best = 0;
    for (let i = 1; i < geo.times.length; i++) if (Math.abs(geo.x(geo.times[i]!) - px) < Math.abs(geo.x(geo.times[best]!) - px)) best = i;
    const s = samples[best]!;
    setHover(best);
    const vals = trend.series
      .filter((sr) => s.values[sr.key] !== undefined)
      .map((sr) => `${sr.label} ${s.values[sr.key]!.toFixed(1)}`)
      .join(' · ');
    setTip({ x: geo.x(geo.times[best]!), y: PAD.top + 8, value: vals || '—', label: fmt.dateTime(s.taken_at) });
  };

  if (!samples.length) return <div className="py-10 text-center text-sm text-slate-500">{t('substation.noReadings')}</div>;

  return (
    <div>
      <div ref={ref} className="relative" style={{ height }}>
        {geo && (
          <svg
            width={width}
            height={height}
            className="block touch-none"
            onPointerMove={onMove}
            onPointerLeave={() => {
              setTip(null);
              setHover(null);
            }}
            role="img"
            aria-label={t('substation.trendTitle')}
          >
            {geo.ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(v)} y2={geo.y(v)} className="stroke-ink-600" strokeWidth={1} />
                <text x={PAD.left - 6} y={geo.y(v)} dy="0.32em" textAnchor="end" className="fill-slate-500 font-mono text-[10px]">
                  {v}
                </text>
              </g>
            ))}
            <text x={PAD.left - 6} y={PAD.top - 3} textAnchor="end" className="fill-slate-500 text-[10px]">
              {unit}
            </text>
            {ambient && <polyline points={ambient} fill="none" stroke="rgb(var(--slate-500))" strokeWidth={1.25} strokeDasharray="4 4" />}
            {trend.series.map((sr, i) => (
              <polyline
                key={sr.key}
                points={line(sr.key)}
                fill="none"
                stroke={colorOf(sr.key, i)}
                strokeOpacity={highlight && sr.key !== highlight ? 0.55 : 1}
                strokeWidth={sr.key === highlight ? 2.5 : 1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {trend.series.map((sr, i) =>
              samples.map((s, j) =>
                s.values[sr.key] === undefined || (samples.length > 40 && j !== hover) ? null : (
                  <circle
                    key={`${sr.key}-${j}`}
                    cx={geo.x(geo.times[j]!)}
                    cy={geo.y(s.values[sr.key]!)}
                    r={j === hover ? 3.5 : 2}
                    fill={colorOf(sr.key, i)}
                    className="stroke-ink-900"
                    strokeWidth={1}
                  />
                ),
              ),
            )}
            {hover !== null && (
              <line
                x1={geo.x(geo.times[hover]!)}
                x2={geo.x(geo.times[hover]!)}
                y1={PAD.top}
                y2={PAD.top + geo.plotH}
                className="stroke-slate-500"
                strokeDasharray="2 3"
              />
            )}
            {/* The rating of every capture, under the plot. */}
            {samples.map((s, j) => (
              <rect
                key={j}
                x={geo.x(geo.times[j]!) - 2}
                y={PAD.top + geo.plotH + 6}
                width={4}
                height={6}
                rx={1}
                fill={s.priority ? priorityColor(s.priority as Priority) : 'rgb(var(--ink-500))'}
              />
            ))}
            <text x={PAD.left} y={height - 2} className="fill-slate-500 text-[10px]">
              {fmt.day(new Date(geo.t0).toISOString())}
            </text>
            <text x={width - PAD.right} y={height - 2} textAnchor="end" className="fill-slate-500 text-[10px]">
              {fmt.day(new Date(geo.t1).toISOString())}
            </text>
          </svg>
        )}
        <ChartTooltip tip={tip} width={width} />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        {trend.series.map((sr, i) => (
          <li key={sr.key} className={cx('flex items-center gap-1.5', highlight && sr.key === highlight && 'font-medium text-slate-100')}>
            <span className="h-0.5 w-4 rounded-full" style={{ background: colorOf(sr.key, i) }} />
            {sr.label}
          </li>
        ))}
        {samples.some((s) => s.ambient_c !== null) && (
          <li className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t border-dashed border-slate-500" />
            {t('substation.ambient')}
          </li>
        )}
      </ul>
      <SrTable
        caption={t('substation.trendTitle')}
        head={[t('common.time'), ...trend.series.map((s) => s.label)]}
        rows={samples.map((s) => [fmt.dateTime(s.taken_at), ...trend.series.map((sr) => s.values[sr.key]?.toFixed(1) ?? '—')])}
      />
    </div>
  );
}
