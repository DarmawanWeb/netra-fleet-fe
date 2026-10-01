'use client';

import { useMemo } from 'react';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n';

const TZ = process.env.NEXT_PUBLIC_TZ ?? 'Asia/Jakarta';

/** Locale-aware formatters for the current language. */
export function useFmt() {
  const { intl, t } = useI18n();
  return useMemo(() => {
    const dt = new Intl.DateTimeFormat(intl, { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ });
    const tm = new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit', timeZone: TZ });
    const tms = new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TZ });
    const dy = new Intl.DateTimeFormat(intl, { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
    const hourOf = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ });
    return {
      dateTime: (iso: string | null | undefined) => (iso ? dt.format(new Date(iso)) : '—'),
      time: (iso: string) => tm.format(new Date(iso)),
      timeSec: (iso: string) => tms.format(new Date(iso)),
      day: (iso: string) => dy.format(new Date(iso)),
      hourOfDay: (iso: string) => Number(hourOf.format(new Date(iso))) % 24,
      pct: (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`),
      duration: (fromIso: string | null, toIso: string | null) => {
        if (!fromIso) return '—';
        const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
        const min = Math.max(0, Math.round(ms / 60000));
        return min < 60 ? `${min} ${t('time.min')}` : `${Math.floor(min / 60)} ${t('time.h')} ${min % 60} ${t('time.min')}`;
      },
      ago: (iso: string | null) => {
        if (!iso) return t('time.never');
        const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
        if (s < 60) return t('time.secondsAgo', { n: s });
        if (s < 3600) return t('time.minutesAgo', { n: Math.round(s / 60) });
        return t('time.hoursAgo', { n: Math.round(s / 3600) });
      },
    };
  }, [intl, t]);
}

export interface RangePreset {
  key: '24h' | 'today' | '7d' | '30d';
  label: MessageKey;
  range: () => { from: Date; to: Date };
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const RANGE_PRESETS: RangePreset[] = [
  { key: 'today', label: 'range.today', range: () => ({ from: startOfDay(new Date()), to: new Date() }) },
  { key: '24h', label: 'range.24h', range: () => ({ from: new Date(Date.now() - 864e5), to: new Date() }) },
  { key: '7d', label: 'range.7d', range: () => ({ from: new Date(Date.now() - 7 * 864e5), to: new Date() }) },
  { key: '30d', label: 'range.30d', range: () => ({ from: new Date(Date.now() - 30 * 864e5), to: new Date() }) },
];

export const presetRange = (key: string) => (RANGE_PRESETS.find((p) => p.key === key) ?? RANGE_PRESETS[2]!).range();
