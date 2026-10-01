const TZ = process.env.NEXT_PUBLIC_TZ ?? 'Asia/Jakarta';

export const fmtDateTime = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(new Date(iso))
    : '—';

export const fmtTime = (iso: string): string =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));

export const fmtDay = (iso: string): string =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso));

export function fmtDuration(fromIso: string | null, toIso: string | null): string {
  if (!fromIso) return '—';
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 60 ? `${min} mnt` : `${Math.floor(min / 60)} j ${min % 60} mnt`;
}

export const fmtPct = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);

export function ago(iso: string | null): string {
  if (!iso) return 'belum pernah';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s} dtk lalu`;
  if (s < 3600) return `${Math.round(s / 60)} mnt lalu`;
  return `${Math.round(s / 3600)} jam lalu`;
}

export interface RangePreset {
  key: string;
  label: string;
  range: () => { from: Date; to: Date };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const RANGE_PRESETS: RangePreset[] = [
  { key: 'today', label: 'Hari ini', range: () => ({ from: startOfDay(new Date()), to: new Date() }) },
  { key: '24h', label: '24 jam', range: () => ({ from: new Date(Date.now() - 864e5), to: new Date() }) },
  { key: '7d', label: '7 hari', range: () => ({ from: new Date(Date.now() - 7 * 864e5), to: new Date() }) },
  { key: '30d', label: '30 hari', range: () => ({ from: new Date(Date.now() - 30 * 864e5), to: new Date() }) },
];
