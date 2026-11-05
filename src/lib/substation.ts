import type { Finding, Priority, ThermalResult } from './types';

/** NETA priorities, the most severe first. */
export const PRIORITIES = [1, 2, 3, 4] as const;

/** Full class names per priority (0 = normal), so the build keeps them. */
export const PRIORITY_TEXT: Record<Priority, string> = { 0: 'text-ok', 1: 'text-p1', 2: 'text-p2', 3: 'text-p3', 4: 'text-p4' };
export const PRIORITY_BG: Record<Priority, string> = { 0: 'bg-ok', 1: 'bg-p1', 2: 'bg-p2', 3: 'bg-p3', 4: 'bg-p4' };
export const PRIORITY_SOFT: Record<Priority, string> = {
  0: 'bg-ok/10 text-ok ring-ok/35',
  1: 'bg-p1/15 text-p1 ring-p1/45',
  2: 'bg-p2/15 text-p2 ring-p2/45',
  3: 'bg-p3/15 text-p3 ring-p3/45',
  4: 'bg-p4/15 text-p4 ring-p4/45',
};
export const PRIORITY_BORDER: Record<Priority, string> = {
  0: 'border-ok/50',
  1: 'border-p1',
  2: 'border-p2',
  3: 'border-p3',
  4: 'border-p4',
};

/** The colour of a priority for SVG and inline styles. */
export const priorityColor = (p: Priority | null | undefined) => `rgb(var(--${p ? `p${p}` : 'ok'}))`;

/** The more severe of two priorities (0 is none). */
export const worse = (a: Priority, b: Priority): Priority => (a === 0 || (b !== 0 && b < a) ? b : a);

/** The rise that rated a reading: over the ambient air when that rated it, else over the similar component. */
export function ratedDelta(r: ThermalResult): number | null {
  if (r.basis === 'ambient') return r.delta_ambient_c;
  return r.delta_similar_c ?? r.delta_ambient_c;
}

/** The reading of a thermal capture that matters most: the most severe, then the hottest. */
export function keyReading(results: ThermalResult[] | undefined): ThermalResult | undefined {
  return [...(results ?? [])].sort((a, b) => {
    const pa = a.priority || 9;
    const pb = b.priority || 9;
    return pa !== pb ? pa - pb : b.max_c - a.max_c;
  })[0];
}

export const celsius = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? '—' : `${v.toFixed(digits)} °C`);
export const signed = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`);

/** A finding's reading as a short text: "58.3 °C" or "25.0 dB". */
export const findingValue = (f: Pick<Finding, 'kind' | 'last_value'>) =>
  f.last_value === null ? '—' : f.kind === 'pd' ? `${f.last_value.toFixed(1)} dB` : celsius(f.last_value);

/** Categorical colours for the targets of one point: distinct in both themes, none of them a priority colour. */
export const SERIES = ['#22b8cf', '#5b8def', '#94a3b8', '#14b8a6', '#c2a36b', '#e879a8', '#7dd3fc', '#a3a3a3'];
