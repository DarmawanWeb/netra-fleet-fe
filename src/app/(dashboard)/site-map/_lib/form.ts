import type { ControlPoint } from '@/lib/types';

/** A control point as edited: text fields, so partial numbers ("-6.") can be typed. */
export interface PointRow {
  key: string;
  label: string;
  x: string;
  y: string;
  lat: string;
  lon: string;
}

let seq = 0;
export const rowKey = () => `p${++seq}`;

/** The number in a field, NaN when empty or not a number. */
export const num = (s: string) => (s.trim() === '' ? NaN : Number(s.trim()));

/** A number for a field, without trailing zeros. */
export const field = (v: number, digits: number) => String(Number(v.toFixed(digits)));

export const isComplete = (r: PointRow) => [r.x, r.y, r.lat, r.lon].every((v) => Number.isFinite(num(v)));

/** Latitude and longitude of a row, when both are filled in and on the earth. */
export function rowLatLon(r: PointRow): [number, number] | null {
  const lat = num(r.lat);
  const lon = num(r.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}

export const toPoint = (r: PointRow): ControlPoint => ({
  label: r.label.trim(),
  x: num(r.x),
  y: num(r.y),
  lat: num(r.lat),
  lon: num(r.lon),
});

export const rowOf = (p: ControlPoint): PointRow => ({
  key: rowKey(),
  label: p.label,
  x: field(p.x, 3),
  y: field(p.y, 3),
  lat: field(p.lat, 7),
  lon: field(p.lon, 7),
});

export const emptyRow = (): PointRow => ({ key: rowKey(), label: '', x: '', y: '', lat: '', lon: '' });

/** "lat, lon" pasted into one field (as map apps copy it), split into both. */
export function splitLatLon(text: string): [string, string] | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  return m ? [m[1]!, m[2]!] : null;
}
