'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react';
import { api } from '@/lib/api';
import type { FloorPlan } from '@/lib/types';

interface View {
  x: number;
  y: number;
  w: number;
}

/** Plan pixels per screen pixel at the current zoom, and whether the plan is drawn light (day). */
const PlanViewContext = createContext<{ unitsPerPx: number | null; day: boolean }>({ unitsPerPx: null, day: false });

/** Size factor for map symbols: screen pixels inside a FloorPlanView, else roughly metres of the plan. */
export function useMarkerScale(pxPerM: number): number {
  return useContext(PlanViewContext).unitsPerPx ?? Math.max(pxPerM / 20, 0.6);
}

/** True on a light (day) plan, where overlays need darker colours. */
export const useMapDay = () => useContext(PlanViewContext).day;

/** A point of the plan (pixels) to keep in the middle of the view, optionally at a zoom (view width in px). */
export interface Focus {
  px: number;
  py: number;
  w?: number;
}

/**
 * Pan/zoom viewer of a floor plan; children are SVG overlays in plan pixel coordinates.
 * Variants: `dimmed` (default, the plan faded on navy), `night` (the light plan file inverted into a
 * dark map so live overlays stand out) and `day` (the plan as drawn, for the light theme).
 */
export function FloorPlanView({
  plan,
  children,
  onPlanClick,
  onUserMove,
  focus,
  variant = 'dimmed',
  className = 'h-[560px]',
}: {
  plan: FloorPlan;
  children?: ReactNode;
  onPlanClick?: (px: number, py: number) => void;
  /** Called when the person pans or zooms (e.g. to stop following a robot). */
  onUserMove?: () => void;
  focus?: Focus | null;
  variant?: 'dimmed' | 'night' | 'day';
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const filterId = useId().replace(/:/g, '');
  const width = plan.width_px || 1000;
  const height = plan.height_px || 700;
  const [view, setView] = useState<View>({ x: 0, y: 0, w: width });
  const drag = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const aspect = height / width;
  const night = variant === 'night';
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setBox({ w: entry!.contentRect.width, h: entry!.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const unitsPerPx = box && box.w > 0 && box.h > 0 ? Math.max(view.w / box.w, (view.w * aspect) / box.h) : null;

  useEffect(() => setView({ x: 0, y: 0, w: width }), [plan.id, width]);

  useEffect(() => {
    if (!focus) return;
    setView((v) => {
      const w = focus.w ?? v.w;
      return { x: focus.px - w / 2, y: focus.py - (w * aspect) / 2, w };
    });
  }, [focus, aspect]);

  const toPlan = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { px: 0, py: 0 };
      // preserveAspectRatio "meet": the viewBox is scaled by the tighter axis and centred on the other.
      const scale = Math.max(view.w / rect.width, (view.w * aspect) / rect.height);
      const offsetX = (rect.width * scale - view.w) / 2;
      const offsetY = (rect.height * scale - view.w * aspect) / 2;
      return { px: view.x - offsetX + (clientX - rect.left) * scale, py: view.y - offsetY + (clientY - rect.top) * scale };
    },
    [view, aspect],
  );

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const { px, py } = toPlan(e.clientX, e.clientY);
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const w = Math.min(width * 4, Math.max(width / 40, view.w * factor));
    const k = w / view.w;
    setView({ x: px - (px - view.x) * k, y: py - (py - view.y) * k, w });
    onUserMove?.();
  };

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!d || !rect || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) <= 3) return;
    if (!d.moved) {
      // Capture only once it is a drag, so a plain click still reaches pins and markers.
      d.moved = true;
      svgRef.current?.setPointerCapture(e.pointerId);
      onUserMove?.();
    }
    const scale = Math.max(view.w / rect.width, (view.w * aspect) / rect.height);
    setView((v) => ({ ...v, x: v.x - dx * scale, y: v.y - dy * scale }));
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && onPlanClick) {
      const { px, py } = toPlan(e.clientX, e.clientY);
      onPlanClick(px, py);
    }
  };

  const zoomBy = (f: number) => {
    setView((v) => {
      const w = v.w * f;
      return { x: v.x + (v.w - w) / 2, y: v.y + ((v.w - w) * aspect) / 2, w };
    });
    onUserMove?.();
  };

  return (
    <div className={`relative overflow-hidden rounded-lg border border-ink-600 bg-ink-950 ${className}`}>
      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.w * aspect}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
      >
        {night && (
          <defs>
            {/* Invert lightness, keep hue: light plan → dark map with the same tenant colours, muted. */}
            <filter id={filterId} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" />
              <feColorMatrix type="hueRotate" values="180" />
              <feColorMatrix type="saturate" values="0.55" />
              <feComponentTransfer>
                <feFuncR type="linear" slope="0.78" intercept="0.02" />
                <feFuncG type="linear" slope="0.8" intercept="0.03" />
                <feFuncB type="linear" slope="0.86" intercept="0.05" />
              </feComponentTransfer>
            </filter>
          </defs>
        )}
        <rect x={0} y={0} width={width} height={height} fill={{ dimmed: '#0b1220', night: '#070c16', day: '#f8fafc' }[variant]} />
        <image
          href={api.floorPlans.fileUrl(plan.id)}
          x={0}
          y={0}
          width={width}
          height={height}
          opacity={variant === 'dimmed' ? 0.85 : 1}
          filter={night ? `url(#${filterId})` : undefined}
        />
        <PlanViewContext.Provider value={{ unitsPerPx, day: variant === 'day' }}>{children}</PlanViewContext.Provider>
      </svg>
      <div className="absolute bottom-2 right-2 flex gap-1">
        {[
          ['+', 1 / 1.4],
          ['−', 1.4],
        ].map(([label, f]) => (
          <button
            key={label as string}
            aria-label={label === '+' ? 'zoom in' : 'zoom out'}
            className="h-7 w-7 rounded border border-ink-500 bg-ink-900/90 text-slate-200 hover:text-accent"
            onClick={() => zoomBy(f as number)}
          >
            {label}
          </button>
        ))}
        <button
          aria-label="reset view"
          className="h-7 rounded border border-ink-500 bg-ink-900/90 px-2 text-xs text-slate-200 hover:text-accent"
          onClick={() => (setView({ x: 0, y: 0, w: width }), onUserMove?.())}
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
