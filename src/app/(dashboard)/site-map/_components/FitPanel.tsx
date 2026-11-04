'use client';

import { IconCheck, IconInfo, IconOctagon } from '@/components/icons';
import { cx } from '@/components/ui';
import { useI18n, type MessageKey } from '@/i18n';
import type { GeoTransform } from '@/lib/types';

/** When a fit deserves a second look: metres of RMS or of one point, scale away from 1, points too close together. */
export const LIMITS = { rms: 1, residual: 1.5, scale: 0.03, spread: 20 };

export interface FitState {
  transform: GeoTransform | null;
  error?: string;
  busy?: boolean;
}

interface Note {
  key: MessageKey;
  vars?: Record<string, string | number>;
  tone: 'warn' | 'info';
}

/** The fit of the control points: its figures and what to check. */
export function FitPanel({
  fit,
  residuals,
  points,
  spread,
}: {
  fit: FitState;
  /** Residual of each complete point, with its number in the list. */
  residuals: { n: number; m: number }[];
  /** Complete control points. */
  points: number;
  /** Largest map distance between two complete points, metres. */
  spread: number;
}) {
  const { t } = useI18n();
  const tr = fit.transform;
  const notes: Note[] = [];
  if (tr) {
    if (tr.method === 'heading') notes.push({ key: 'siteMap.noteHeading', tone: 'info' });
    else if (points === 2) notes.push({ key: 'siteMap.noteTwo', tone: 'info' });
    if (tr.rms_m > LIMITS.rms) notes.push({ key: 'siteMap.noteRms', vars: { m: tr.rms_m.toFixed(2) }, tone: 'warn' });
    residuals
      .filter((r) => r.m > LIMITS.residual)
      .forEach((r) => notes.push({ key: 'siteMap.notePoint', vars: { n: r.n, m: r.m.toFixed(2) }, tone: 'warn' }));
    if (Math.abs(tr.scale - 1) > LIMITS.scale) notes.push({ key: 'siteMap.noteScale', vars: { s: tr.scale.toFixed(3) }, tone: 'warn' });
    if (tr.method === 'points' && spread < LIMITS.spread)
      notes.push({ key: 'siteMap.noteSpread', vars: { m: spread.toFixed(1) }, tone: 'warn' });
  }
  const good = tr && !notes.some((n) => n.tone === 'warn');

  if (fit.error)
    return (
      <div className="flex gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
        <IconOctagon width={18} height={18} className="mt-0.5 shrink-0" aria-hidden />
        <span>{fit.error}</span>
      </div>
    );
  if (!tr) return <p className="text-sm text-slate-400">{t('siteMap.fitNone')}</p>;
  const figures: [string, string, boolean][] = [
    [t('siteMap.rms'), tr.method === 'heading' ? '—' : `${tr.rms_m.toFixed(2)} m`, true],
    [t('siteMap.scale'), tr.scale.toFixed(4), true],
    [t('siteMap.xHeading'), `${tr.heading_deg.toFixed(1)}°`, true],
    [t('siteMap.method'), tr.method === 'heading' ? t('siteMap.methodHeading') : t('siteMap.methodPoints', { n: points }), false],
  ];
  return (
    <div className={cx('space-y-3 transition-opacity', fit.busy && 'opacity-60')}>
      <div className="flex items-center gap-2 text-sm">
        {good ? (
          <IconCheck width={18} height={18} className="text-ok" aria-hidden />
        ) : (
          <IconInfo width={18} height={18} className="text-warn" aria-hidden />
        )}
        <span className={good ? 'text-ok' : 'text-warn'}>{good ? t('siteMap.fitGood') : t('siteMap.fitCheck')}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {figures.map(([k, v, mono]) => (
          <div key={k} className="rounded-md border border-ink-600 bg-ink-800/50 px-3 py-2">
            <dt className="text-[10px] uppercase tracking-widest text-slate-500">{k}</dt>
            <dd className={cx('mt-0.5 text-sm text-slate-100', mono && 'font-mono')}>{v}</dd>
          </div>
        ))}
      </dl>
      {notes.length > 0 && (
        <ul className="space-y-1.5">
          {notes.map((n, i) => (
            <li key={i} className={cx('flex gap-2 text-xs', n.tone === 'warn' ? 'text-warn' : 'text-slate-400')}>
              <span className={cx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.tone === 'warn' ? 'bg-warn' : 'bg-slate-500')} />
              <span>{t(n.key, n.vars)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
