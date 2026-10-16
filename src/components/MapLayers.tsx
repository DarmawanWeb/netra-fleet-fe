'use client';

import { useMapDay, useMarkerScale } from '@/components/FloorPlanView';
import { mapToPlan, planHeadingDeg } from '@/lib/geometry';
import type { FloorPlan, HeatCell, Pose, RoutePoint } from '@/lib/types';

/** Recorded route as a polyline with numbered stop points. */
export function RouteLayer({ plan, points, color }: { plan: FloorPlan; points: RoutePoint[]; color?: string }) {
  const s = useMarkerScale(plan.px_per_m);
  const day = useMapDay();
  const stroke = color ?? (day ? '#0e7490' : '#22d3ee');
  if (points.length < 2) return null;
  const d = points.map(([x, y], i) => {
    const { px, py } = mapToPlan(plan, x, y);
    return `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
  });
  const stops = points.filter((p) => p[3] > 0);
  return (
    <g>
      <path d={d.join(' ')} fill="none" stroke={stroke} strokeWidth={3 * s} strokeOpacity={0.75} strokeLinejoin="round" />
      {stops.map(([x, y], i) => {
        const { px, py } = mapToPlan(plan, x, y);
        return (
          <g key={i} transform={`translate(${px},${py})`}>
            <circle r={9 * s} fill={day ? '#ffffff' : '#0a101c'} stroke={stroke} strokeWidth={2 * s} />
            <text textAnchor="middle" dy={3.5 * s} fontSize={10 * s} fill={stroke} fontWeight={700}>
              {i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}

const ROBOT_TONE = { ok: '#22d3ee', warn: '#f59e0b', danger: '#ef4444', idle: '#94a3b8' } as const;
const ROBOT_TONE_DAY: Record<RobotTone, string> = { ok: '#0e7490', warn: '#b45309', danger: '#dc2626', idle: '#475569' };
export type RobotTone = keyof typeof ROBOT_TONE;

/** Colour of a robot state on the night (dark) or day (light) map. */
export const toneColor = (tone: RobotTone, day: boolean) => (day ? ROBOT_TONE_DAY : ROBOT_TONE)[tone];

/** Fading line of recent positions (oldest first), drawn under the robot markers. */
export function TrailLayer({ plan, poses, tone = 'ok' }: { plan: FloorPlan; poses: Pose[]; tone?: RobotTone }) {
  const s = useMarkerScale(plan.px_per_m);
  const day = useMapDay();
  if (poses.length < 2) return null;
  const pts = poses.map((p) => mapToPlan(plan, p.x, p.y));
  return (
    <g strokeLinecap="round" stroke={(day ? ROBOT_TONE_DAY : ROBOT_TONE)[tone]} fill="none">
      {pts.slice(1).map((p, i) => (
        <line
          key={i}
          x1={pts[i]!.px}
          y1={pts[i]!.py}
          x2={p.px}
          y2={p.py}
          strokeWidth={2.5 * s}
          strokeOpacity={0.08 + 0.55 * ((i + 1) / pts.length)}
        />
      ))}
    </g>
  );
}

/** Robot marker with heading, name and a pulse when it is in an alarm state. */
export function RobotMarker({
  plan,
  pose,
  name,
  alarm,
  tone,
  selected,
  inspecting,
  onClick,
}: {
  plan: FloorPlan;
  pose: Pose;
  name: string;
  alarm?: boolean;
  /** Colour by state; overrides alarm. */
  tone?: RobotTone;
  selected?: boolean;
  /** Dwelling at a stop: a slow scanning sweep. */
  inspecting?: boolean;
  onClick?: () => void;
}) {
  const { px, py } = mapToPlan(plan, pose.x, pose.y);
  const s = useMarkerScale(plan.px_per_m);
  const day = useMapDay();
  const color = (day ? ROBOT_TONE_DAY : ROBOT_TONE)[tone ?? (alarm ? 'danger' : 'ok')];
  const ink = day ? '#ffffff' : '#05080f';
  const heading = planHeadingDeg(plan, pose.yaw);
  return (
    <g
      transform={`translate(${px},${py})`}
      className={onClick ? 'cursor-pointer' : undefined}
      onMouseUp={onClick ? (e) => (e.stopPropagation(), onClick()) : undefined}
    >
      <circle className="motion-live" r={22 * s} fill={color} opacity={0.15}>
        <animate attributeName="r" values={`${14 * s};${26 * s};${14 * s}`} dur="2s" repeatCount="indefinite" />
      </circle>
      {inspecting && (
        <g className="motion-live">
          <path d={`M0,0 L${34 * s},${-12 * s} A${36 * s},${36 * s} 0 0 1 ${34 * s},${12 * s} Z`} fill={color} opacity={0.22}>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite" />
          </path>
        </g>
      )}
      {selected && <circle r={20 * s} fill="none" stroke={day ? '#0f172a' : '#f8fafc'} strokeWidth={2 * s} strokeOpacity={0.9} />}
      <g transform={`rotate(${heading})`}>
        <path d={`M${14 * s},0 L${-9 * s},${9 * s} L${-4 * s},0 L${-9 * s},${-9 * s} Z`} fill={color} stroke={ink} strokeWidth={1.5 * s} />
      </g>
      <text
        y={-(selected ? 25 : 18) * s}
        textAnchor="middle"
        fontSize={12 * s}
        fontWeight={selected ? 700 : 500}
        fill={day ? '#0f172a' : '#e2e8f0'}
        stroke={ink}
        strokeWidth={3 * s}
        paintOrder="stroke"
      >
        {name}
      </text>
    </g>
  );
}

/** Warning pin for an anomaly; pulses while it waits for validation, ripples when it just arrived. */
export function AnomalyPin({
  plan,
  x,
  y,
  pending,
  label,
  fresh,
  onClick,
}: {
  plan: FloorPlan;
  x: number;
  y: number;
  pending: boolean;
  label: string;
  fresh?: boolean;
  onClick?: () => void;
}) {
  const { px, py } = mapToPlan(plan, x, y);
  const s = useMarkerScale(plan.px_per_m);
  const day = useMapDay();
  const color = pending ? (day ? '#d97706' : '#f59e0b') : day ? '#dc2626' : '#ef4444';
  return (
    <g transform={`translate(${px},${py})`} className="cursor-pointer" onMouseUp={(e) => (e.stopPropagation(), onClick?.())}>
      {fresh && (
        <circle className="motion-live" r={16 * s} fill="none" stroke={color} strokeWidth={3 * s}>
          <animate attributeName="r" values={`${12 * s};${48 * s}`} dur="1.1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0" dur="1.1s" repeatCount="indefinite" />
        </circle>
      )}
      {pending && (
        <circle className="motion-live" r={12 * s} fill="none" stroke={color} strokeWidth={2 * s}>
          <animate attributeName="r" values={`${10 * s};${22 * s}`} dur="1.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0" dur="1.4s" repeatCount="indefinite" />
        </circle>
      )}
      <path d={`M0,${-14 * s} L${12 * s},${8 * s} L${-12 * s},${8 * s} Z`} fill={color} stroke="#05080f" strokeWidth={1.5 * s} />
      <text y={5 * s} textAnchor="middle" fontSize={12 * s} fontWeight={800} fill="#05080f">
        !
      </text>
      <title>{label}</title>
    </g>
  );
}

/** Colour of a crowd cell from its share of the busiest cell (0..1): cyan, green, amber, red. */
export const heatColor = (t: number) => {
  const stops = [
    [34, 211, 238],
    [34, 197, 94],
    [245, 158, 11],
    [239, 68, 68],
  ];
  const f = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(f);
  const a = stops[i] ?? stops[0]!;
  const b = stops[i + 1] ?? a;
  const k = f - i;
  return `rgb(${a.map((v, j) => Math.round(v + ((b[j] ?? v) - v) * k)).join(',')})`;
};

/** Crowd cells drawn as rotated squares coloured by peak (or mean) people. */
export function HeatLayer({
  plan,
  cells,
  metric = 'peak',
  unit = 'people',
}: {
  plan: FloorPlan;
  cells: HeatCell[];
  metric?: 'peak' | 'mean';
  unit?: string;
}) {
  const max = Math.max(1, ...cells.map((c) => c[metric]));
  const deg = (plan.rotation_rad * 180) / Math.PI;
  return (
    <g>
      {cells.map((c) => {
        const { px, py } = mapToPlan(plan, c.x, c.y + c.size);
        const size = c.size * plan.px_per_m;
        return (
          <rect
            key={`${c.x},${c.y}`}
            x={px}
            y={py}
            width={size}
            height={size}
            transform={`rotate(${deg} ${px} ${py})`}
            fill={heatColor(c[metric] / max)}
            fillOpacity={0.25 + 0.5 * (c[metric] / max)}
          >
            <title>{`${c[metric]} ${unit} (${c.samples})`}</title>
          </rect>
        );
      })}
    </g>
  );
}

export function HeatLegend({ max, unit }: { max: number; unit: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span>0</span>
      <div className="h-2 w-40 rounded" style={{ background: 'linear-gradient(90deg,#22d3ee,#22c55e,#f59e0b,#ef4444)' }} />
      <span>
        {max} {unit}
      </span>
    </div>
  );
}
