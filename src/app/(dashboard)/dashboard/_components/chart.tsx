'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Width of an element, following resizes (charts draw in real pixels so text never stretches).
 * Returns a callback ref, so it also works for an element that appears after the data arrives.
 */
export function useWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

export interface Tip {
  /** Position inside the chart container, in px. */
  x: number;
  y: number;
  value: ReactNode;
  label: ReactNode;
  /** Short line key in the mark colour. */
  color?: string;
}

/** One tooltip per chart: the value leads, the label follows. Stays inside the container. */
export function ChartTooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 70), Math.max(70, width - 70));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-ink-500 bg-ink-900 px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left, top: tip.y - 6 }}
    >
      <div className="font-semibold text-slate-100">{tip.value}</div>
      <div className="flex items-center gap-1.5 text-slate-400">
        {tip.color && <span className="h-0.5 w-3 rounded-full" style={{ background: tip.color }} />}
        {tip.label}
      </div>
    </div>
  );
}

/** The chart's values as a table for screen readers. */
export function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
