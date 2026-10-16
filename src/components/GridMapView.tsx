'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { useI18n } from '@/i18n';
import { useTheme } from '@/lib/theme';
import type { HeatCell, Pose, RoutePoint } from '@/lib/types';
import { heatColor, toneColor, type RobotTone } from './MapLayers';
import { cx } from './ui';

export interface GridRobot {
  id: string;
  name: string;
  pose: Pose;
  alarm?: boolean;
  /** Colour by state; overrides alarm. */
  tone?: RobotTone;
  selected?: boolean;
  /** Dwelling at a stop: a slow scanning sweep. */
  inspecting?: boolean;
}

export interface GridAnomaly {
  id: number;
  x: number;
  y: number;
  label: string;
  pending: boolean;
  /** Just arrived: ripples for a while. */
  fresh?: boolean;
}

/** Recent positions of a robot, oldest first. */
export interface GridTrail {
  id: string;
  poses: Pose[];
  tone?: RobotTone;
}

/** Crowd cells (map frame, lower-left corner and size in metres) coloured by peak or mean people. */
export interface GridHeat {
  cells: HeatCell[];
  metric?: 'peak' | 'mean';
  unit: string;
}

/** A plain polyline in map metres, e.g. a recorded track; colour defaults to the route colour. */
export interface GridPath {
  points: [number, number][];
  color?: string;
  opacity?: number;
}

/** Point kept in the centre while a robot is followed, in map metres; w zooms to that width. */
export interface GridFocus {
  x: number;
  y: number;
  w?: number;
}

interface View {
  cx: number; // centre of the view in map metres
  cy: number;
  w: number; // visible width in metres
}

const MIN_W = 4;
const MAX_W = 2000;
const NO_CELLS: HeatCell[] = [];
const NO_PATHS: GridPath[] = [];
const PALETTE = {
  dark: {
    bg: '#0a101c',
    minor: '#1b2638',
    major: '#2c3c55',
    axisX: '#f87171',
    axisY: '#4ade80',
    text: '#94a3b8',
    route: '#22d3ee',
    robot: '#22d3ee',
    alarm: '#ef4444',
    stopFill: '#0a101c',
  },
  light: {
    bg: '#f8fafc',
    minor: '#e2e8f0',
    major: '#cbd5e1',
    axisX: '#dc2626',
    axisY: '#16a34a',
    text: '#475569',
    route: '#0e7490',
    robot: '#0e7490',
    alarm: '#dc2626',
    stopFill: '#ffffff',
  },
};

/** Bounding box (metres) of everything worth showing, with the origin always included. */
function contentBounds(robots: GridRobot[], routes: RoutePoint[][], anomalies: GridAnomaly[], cells: HeatCell[], paths: GridPath[]) {
  const xs = [0];
  const ys = [0];
  robots.forEach((r) => (xs.push(r.pose.x), ys.push(r.pose.y)));
  routes.forEach((pts) => pts.forEach(([x, y]) => (xs.push(x), ys.push(y))));
  anomalies.forEach((a) => (xs.push(a.x), ys.push(a.y)));
  cells.forEach((c) => (xs.push(c.x, c.x + c.size), ys.push(c.y, c.y + c.size)));
  paths.forEach((p) => p.points.forEach(([x, y]) => (xs.push(x), ys.push(y))));
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Grid step (metres) so that lines stay at least ~12 px apart. */
function gridStep(pxPerM: number) {
  for (const step of [1, 5, 10, 50, 100]) if (step * pxPerM >= 12) return step;
  return 500;
}

/** Scale bar length (metres) close to 100 px. */
function scaleBar(pxPerM: number) {
  const target = 100 / pxPerM;
  return [1, 2, 5, 10, 20, 50, 100, 200, 500].find((m) => m >= target) ?? 1000;
}

/**
 * Map view without a floor plan: a metric grid in the robot's map frame (1 m lines, heavier every
 * 5 m), x/y axes through the origin, and straight from map coordinates: the crowd heatmap, routes,
 * robot trails, anomaly pins and live robots with heading. Pan by dragging, zoom with the wheel or
 * the buttons; `focus` keeps a followed robot in the centre until the operator moves the view.
 */
export function GridMapView({
  robots,
  routes,
  anomalies,
  trails,
  heat,
  paths,
  focus,
  fitKey,
  routeColor,
  onAnomaly,
  onRobot,
  onUserMove,
  className,
}: {
  robots: GridRobot[];
  routes: RoutePoint[][];
  anomalies: GridAnomaly[];
  trails?: GridTrail[];
  heat?: GridHeat;
  paths?: GridPath[];
  focus?: GridFocus | null;
  /** Fit the view again whenever this changes (besides robots, routes or cells appearing). */
  fitKey?: string;
  /** Route colour; cyan by default (the dashboard draws routes neutral under cyan trails). */
  routeColor?: string;
  onAnomaly?: (id: number) => void;
  onRobot?: (id: string) => void;
  /** The operator panned, zoomed or fitted the view (e.g. to stop following). */
  onUserMove?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const day = theme === 'light';
  const palette = PALETTE[day ? 'light' : 'dark'];
  const c = routeColor ? { ...palette, route: routeColor } : palette;
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [view, setView] = useState<View>({ cx: 0, cy: 0, w: 30 });
  const moved = useRef(false); // the operator (or a followed robot) took over the view
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  const cells = heat?.cells ?? NO_CELLS;
  const lines = paths ?? NO_PATHS;
  const metric = heat?.metric ?? 'peak';
  const heatMax = useMemo(() => Math.max(1, ...cells.map((cell) => cell[metric])), [cells, metric]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: Math.max(1, e.contentRect.width), h: Math.max(1, e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const b = contentBounds(robots, routes, anomalies, cells, lines);
    const pad = Math.max(3, 0.06 * Math.max(b.maxX - b.minX, b.maxY - b.minY));
    const w = Math.max(b.maxX - b.minX + 2 * pad, ((b.maxY - b.minY + 2 * pad) * size.w) / size.h, 10);
    setView({ cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, w: Math.min(MAX_W, w) });
  }, [robots, routes, anomalies, cells, lines, size]);

  // Fit whenever robots or routes appear or go away (or, without them, the crowd cells), or the
  // fit key changes, until the operator pans or zooms.
  const contentKey = `${robots.map((r) => r.id).join()}|${routes.map((r) => r.length).join()}|${robots.length || routes.length ? '' : cells.length}|${fitKey ?? ''}`;
  useEffect(() => {
    if (moved.current || (!robots.length && !routes.length && !cells.length && !lines.length)) return;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, size.w, size.h]);

  // Follow: keep the focus point in the centre.
  useEffect(() => {
    if (!focus) return;
    moved.current = true;
    setView((v) => ({ cx: focus.x, cy: focus.y, w: focus.w ?? v.w }));
  }, [focus]);

  const userMove = () => {
    moved.current = true;
    onUserMove?.();
  };

  const pxPerM = size.w / view.w;
  const k = 1 / pxPerM; // metres per screen pixel
  const h = view.w * (size.h / size.w);
  const x0 = view.cx - view.w / 2;
  const x1 = view.cx + view.w / 2;
  const y0 = view.cy - h / 2;
  const y1 = view.cy + h / 2;

  const zoomAt = (factor: number, mx = view.cx, my = view.cy) =>
    setView((v) => {
      const w = Math.min(MAX_W, Math.max(MIN_W, v.w * factor));
      const f = w / v.w;
      return { w, cx: mx + (v.cx - mx) * f, cy: my + (v.cy - my) * f };
    });

  const toMap = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: x0 + ((clientX - r.left) / r.width) * view.w, y: y1 - ((clientY - r.top) / r.height) * h };
  };

  const onWheel = (e: WheelEvent) => {
    const p = toMap(e.clientX, e.clientY);
    userMove();
    zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      userMove();
    }
    d.moved = true;
    const m = d.view.w / size.w;
    setView({ ...d.view, cx: d.view.cx - dx * m, cy: d.view.cy + dy * m });
  };
  const onUp = () => (drag.current = null);

  const grid = useMemo(() => {
    const step = gridStep(pxPerM);
    const major = step === 1 ? 5 : step * 5;
    const lines: { d: string; major: boolean }[] = [];
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step)
      if (Math.abs(x) > 1e-9) lines.push({ d: `M${x},${-y1}V${-y0}`, major: Math.abs(x / major - Math.round(x / major)) < 1e-9 });
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step)
      if (Math.abs(y) > 1e-9) lines.push({ d: `M${x0},${-y}H${x1}`, major: Math.abs(y / major - Math.round(y / major)) < 1e-9 });
    return { lines, major };
  }, [pxPerM, x0, x1, y0, y1]);

  const bar = scaleBar(pxPerM);
  const fs = 11 * k;

  return (
    <div
      ref={box}
      className={cx('relative touch-none select-none overflow-hidden rounded-xl border border-ink-600', className)}
      style={{ background: c.bg }}
      onWheel={onWheel}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${x0} ${-y1} ${view.w} ${h}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t('map.gridTitle')}
      >
        <g fill="none" vectorEffect="non-scaling-stroke">
          {grid.lines.map((l, i) => (
            <path
              key={i}
              d={l.d}
              stroke={l.major ? c.major : c.minor}
              strokeWidth={l.major ? 1.2 : 0.6}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={`M${x0},0H${x1}`} stroke={c.axisX} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <path d={`M0,${-y1}V${-y0}`} stroke={c.axisY} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        </g>

        {cells.map((cell) => (
          <rect
            key={`${cell.x},${cell.y}`}
            x={cell.x}
            y={-(cell.y + cell.size)}
            width={cell.size}
            height={cell.size}
            fill={heatColor(cell[metric] / heatMax)}
            fillOpacity={0.25 + 0.5 * (cell[metric] / heatMax)}
          >
            <title>{`${cell[metric]} ${heat?.unit ?? ''} (${cell.samples})`}</title>
          </rect>
        ))}

        {lines.map((p, i) =>
          p.points.length < 2 ? null : (
            <path
              key={i}
              d={p.points.map(([x, y], j) => `${j ? 'L' : 'M'}${x},${-y}`).join(' ')}
              fill="none"
              stroke={p.color ?? c.route}
              strokeOpacity={p.opacity ?? 0.8}
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}

        <circle r={4 * k} fill={c.text} />
        <text x={6 * k} y={-6 * k} fontSize={fs} fill={c.text}>
          0,0
        </text>
        <text x={x1 - 6 * k} y={-6 * k} fontSize={fs} fill={c.axisX} textAnchor="end" fontWeight={700}>
          x
        </text>
        <text x={6 * k} y={-y1 + 16 * k} fontSize={fs} fill={c.axisY} fontWeight={700}>
          y
        </text>

        {routes.map((pts, ri) =>
          pts.length < 2 ? null : (
            <g key={ri}>
              <path
                d={pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${-y}`).join(' ')}
                fill="none"
                stroke={c.route}
                strokeOpacity={0.8}
                strokeWidth={3}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {pts
                .filter((p) => p[3] > 0)
                .map(([x, y], i) => (
                  <g key={i} transform={`translate(${x},${-y})`}>
                    <circle r={8 * k} fill={c.stopFill} stroke={c.route} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    <text textAnchor="middle" dy={3.5 * k} fontSize={9.5 * k} fill={c.route} fontWeight={700}>
                      {i + 1}
                    </text>
                  </g>
                ))}
            </g>
          ),
        )}

        {trails?.map((tr) =>
          tr.poses.length < 2 ? null : (
            <g key={tr.id} stroke={tr.tone ? toneColor(tr.tone, day) : c.robot} fill="none" strokeLinecap="round">
              {tr.poses.slice(1).map((p, i) => (
                <line
                  key={i}
                  x1={tr.poses[i]!.x}
                  y1={-tr.poses[i]!.y}
                  x2={p.x}
                  y2={-p.y}
                  strokeWidth={2.5}
                  strokeOpacity={0.08 + 0.55 * ((i + 1) / tr.poses.length)}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          ),
        )}

        {anomalies.map((a) => {
          const color = a.pending ? (day ? '#d97706' : '#f59e0b') : day ? '#dc2626' : '#ef4444';
          return (
            <g
              key={a.id}
              transform={`translate(${a.x},${-a.y})`}
              className={onAnomaly ? 'cursor-pointer' : undefined}
              onClick={() => !drag.current?.moved && onAnomaly?.(a.id)}
            >
              <title>{a.label}</title>
              {a.fresh && (
                <circle className="motion-live" r={12 * k} fill="none" stroke={color} strokeWidth={3} vectorEffect="non-scaling-stroke">
                  <animate attributeName="r" values={`${12 * k};${48 * k}`} dur="1.1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0" dur="1.1s" repeatCount="indefinite" />
                </circle>
              )}
              {a.pending && (
                <circle className="motion-live" r={10 * k} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke">
                  <animate attributeName="r" values={`${10 * k};${22 * k}`} dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={9 * k} fill={color} stroke={c.bg} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <text textAnchor="middle" dy={4 * k} fontSize={11 * k} fill="#0a101c" fontWeight={800}>
                !
              </text>
            </g>
          );
        })}

        {robots.map((r) => {
          const tone = r.tone ? toneColor(r.tone, day) : r.alarm ? c.alarm : c.robot;
          const deg = (-r.pose.yaw * 180) / Math.PI;
          return (
            <g
              key={r.id}
              transform={`translate(${r.pose.x},${-r.pose.y})`}
              className={onRobot ? 'cursor-pointer' : undefined}
              onClick={onRobot ? () => !drag.current?.moved && onRobot(r.id) : undefined}
            >
              <circle r={16 * k} fill={tone} fillOpacity={0.15} />
              {r.inspecting && (
                <g className="motion-live">
                  <path d={`M0,0 L${34 * k},${-12 * k} A${36 * k},${36 * k} 0 0 1 ${34 * k},${12 * k} Z`} fill={tone} opacity={0.22}>
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite" />
                  </path>
                </g>
              )}
              {r.selected && (
                <circle
                  r={20 * k}
                  fill="none"
                  stroke={day ? '#0f172a' : '#f8fafc'}
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <path
                d={`M${14 * k},0L${-9 * k},${-8 * k}L${-5 * k},0L${-9 * k},${8 * k}Z`}
                transform={`rotate(${deg})`}
                fill={tone}
                stroke={c.bg}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              <text y={-(r.selected ? 25 : 20) * k} textAnchor="middle" fontSize={fs} fill={c.text} fontWeight={r.selected ? 700 : 600}>
                {r.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-ink-900/80 px-2 py-1 text-[11px] text-slate-300 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 border-x border-b border-slate-300" style={{ width: bar * pxPerM }} />
          <span>{bar} m</span>
        </div>
        <div className="text-slate-500">{t('map.gridLegend', { minor: grid.major / 5, major: grid.major })}</div>
      </div>
      <div className="absolute bottom-3 right-3 flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
        <MapButton label="+" title={t('map.zoomIn')} onClick={() => (userMove(), zoomAt(1 / 1.4))} />
        <MapButton label="−" title={t('map.zoomOut')} onClick={() => (userMove(), zoomAt(1.4))} />
        <MapButton label={t('map.fit')} title={t('map.fitHint')} onClick={() => (onUserMove?.(), (moved.current = false), fit())} />
      </div>
    </div>
  );
}

function MapButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="min-w-8 h-8 rounded border border-ink-600 bg-ink-900/90 px-2 text-sm text-slate-200 backdrop-blur hover:border-accent hover:text-accent"
    >
      {label}
    </button>
  );
}
