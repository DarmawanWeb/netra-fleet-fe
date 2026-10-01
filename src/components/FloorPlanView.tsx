'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode, type WheelEvent } from 'react';
import { api } from '@/lib/api';
import type { FloorPlan } from '@/lib/types';

interface View {
  x: number;
  y: number;
  w: number;
}

/** Pan/zoom viewer of a floor plan; children are SVG overlays in plan pixel coordinates. */
export function FloorPlanView({
  plan,
  children,
  onPlanClick,
  className = 'h-[560px]',
}: {
  plan: FloorPlan;
  children?: ReactNode;
  onPlanClick?: (px: number, py: number) => void;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = plan.width_px || 1000;
  const height = plan.height_px || 700;
  const [view, setView] = useState<View>({ x: 0, y: 0, w: width });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const aspect = height / width;

  useEffect(() => setView({ x: 0, y: 0, w: width }), [plan.id, width]);

  const toPlan = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { px: 0, py: 0 };
      const scale = view.w / rect.width;
      const vh = view.w * (rect.height / rect.width);
      const offsetY = (vh - view.w * aspect) / 2;
      return { px: view.x + (clientX - rect.left) * scale, py: view.y - offsetY + (clientY - rect.top) * scale };
    },
    [view, aspect],
  );

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const { px, py } = toPlan(e.clientX, e.clientY);
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const w = Math.min(width * 4, Math.max(width / 40, view.w * factor));
    const k = w / view.w;
    setView({ x: px - (px - view.x) * k, y: py - (py - view.y) * k, w });
  };

  const onDown = (e: MouseEvent) => (drag.current = { x: e.clientX, y: e.clientY, moved: false });
  const onMove = (e: MouseEvent) => {
    const d = drag.current;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const scale = view.w / rect.width;
    setView((v) => ({ ...v, x: v.x - dx * scale, y: v.y - dy * scale }));
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onUp = (e: MouseEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && onPlanClick) {
      const { px, py } = toPlan(e.clientX, e.clientY);
      onPlanClick(px, py);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-lg border border-ink-600 bg-ink-950 ${className}`}>
      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab select-none active:cursor-grabbing"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.w * aspect}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={() => (drag.current = null)}
      >
        <rect x={0} y={0} width={width} height={height} fill="#0b1220" />
        <image href={api.floorPlans.fileUrl(plan.id)} x={0} y={0} width={width} height={height} opacity={0.85} />
        {children}
      </svg>
      <div className="absolute bottom-2 right-2 flex gap-1">
        {[
          ['+', 1 / 1.4],
          ['−', 1.4],
        ].map(([label, f]) => (
          <button
            key={label as string}
            className="h-7 w-7 rounded border border-ink-500 bg-ink-900/90 text-slate-200 hover:text-accent"
            onClick={() =>
              setView((v) => {
                const w = v.w * (f as number);
                return { x: v.x + (v.w - w) / 2, y: v.y + ((v.w - w) * aspect) / 2, w };
              })
            }
          >
            {label}
          </button>
        ))}
        <button
          className="h-7 rounded border border-ink-500 bg-ink-900/90 px-2 text-xs text-slate-200 hover:text-accent"
          onClick={() => setView({ x: 0, y: 0, w: width })}
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
