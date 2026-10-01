import { mapToPlan, planHeadingDeg } from '@/lib/geometry';
import type { FloorPlan, HeatCell, Pose, RoutePoint } from '@/lib/types';

/** Recorded route as a polyline with numbered stop points. */
export function RouteLayer({ plan, points, color = '#22d3ee' }: { plan: FloorPlan; points: RoutePoint[]; color?: string }) {
  if (points.length < 2) return null;
  const s = Math.max(plan.px_per_m / 20, 0.5);
  const d = points.map(([x, y], i) => {
    const { px, py } = mapToPlan(plan, x, y);
    return `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
  });
  const stops = points.filter((p) => p[3] > 0);
  return (
    <g>
      <path d={d.join(' ')} fill="none" stroke={color} strokeWidth={3 * s} strokeOpacity={0.75} strokeLinejoin="round" />
      {stops.map(([x, y], i) => {
        const { px, py } = mapToPlan(plan, x, y);
        return (
          <g key={i} transform={`translate(${px},${py})`}>
            <circle r={9 * s} fill="#0a101c" stroke={color} strokeWidth={2 * s} />
            <text textAnchor="middle" dy={3.5 * s} fontSize={10 * s} fill={color} fontWeight={700}>
              {i + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Robot marker with heading, name and a pulse when it is in an alarm state. */
export function RobotMarker({ plan, pose, name, alarm }: { plan: FloorPlan; pose: Pose; name: string; alarm?: boolean }) {
  const { px, py } = mapToPlan(plan, pose.x, pose.y);
  const s = Math.max(plan.px_per_m / 20, 0.6);
  const color = alarm ? '#ef4444' : '#22d3ee';
  return (
    <g transform={`translate(${px},${py})`}>
      <circle r={22 * s} fill={color} opacity={0.15}>
        <animate attributeName="r" values={`${14 * s};${26 * s};${14 * s}`} dur="2s" repeatCount="indefinite" />
      </circle>
      <g transform={`rotate(${planHeadingDeg(plan, pose.yaw)})`}>
        <path
          d={`M${14 * s},0 L${-9 * s},${9 * s} L${-4 * s},0 L${-9 * s},${-9 * s} Z`}
          fill={color}
          stroke="#05080f"
          strokeWidth={1.5 * s}
        />
      </g>
      <text y={-18 * s} textAnchor="middle" fontSize={12 * s} fill="#e2e8f0" stroke="#05080f" strokeWidth={3 * s} paintOrder="stroke">
        {name}
      </text>
    </g>
  );
}

/** Warning pin for an anomaly; pulses while it waits for validation. */
export function AnomalyPin({
  plan,
  x,
  y,
  pending,
  label,
  onClick,
}: {
  plan: FloorPlan;
  x: number;
  y: number;
  pending: boolean;
  label: string;
  onClick?: () => void;
}) {
  const { px, py } = mapToPlan(plan, x, y);
  const s = Math.max(plan.px_per_m / 20, 0.6);
  const color = pending ? '#f59e0b' : '#ef4444';
  return (
    <g transform={`translate(${px},${py})`} className="cursor-pointer" onMouseUp={(e) => (e.stopPropagation(), onClick?.())}>
      {pending && (
        <circle r={12 * s} fill="none" stroke={color} strokeWidth={2 * s}>
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

const heatColor = (t: number) => {
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
