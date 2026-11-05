'use client';

import Link from 'next/link';
import { cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { PRIORITIES, PRIORITY_BG, PRIORITY_TEXT } from '@/lib/substation';
import type { SubstationSummary } from '@/lib/types';

/**
 * Findings not resolved, by priority, as one strip: a cell per NETA priority with its count and
 * what it asks for, and the findings nobody has taken in hand yet. Each cell opens the list.
 */
export function PriorityStrip({ summary }: { summary: SubstationSummary }) {
  const { t, tx } = useI18n();
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-ink-600 bg-ink-900/80 sm:grid-cols-5">
      {PRIORITIES.map((p) => {
        const n = summary.findings[String(p)] ?? 0;
        return (
          <Link
            key={p}
            href={`/substation/findings?priority=${p}`}
            className={cx(
              'relative border-b border-r border-ink-600 px-4 pb-3 pt-4 transition hover:bg-ink-800/70 sm:border-b-0',
              n > 0 && p === 1 && 'bg-p1/[0.07]',
            )}
          >
            <span className={cx('absolute inset-x-0 top-0 h-[3px]', n > 0 ? PRIORITY_BG[p] : 'bg-ink-600')} aria-hidden />
            <div className="flex items-baseline gap-2">
              <span className={cx('font-mono text-3xl font-semibold tabular-nums', n > 0 ? PRIORITY_TEXT[p] : 'text-slate-500')}>{n}</span>
              <span className={cx('text-sm font-semibold', n > 0 ? PRIORITY_TEXT[p] : 'text-slate-500')}>P{p}</span>
            </div>
            <div className="mt-1 text-xs leading-snug text-slate-400">{tx('substation.short', String(p))}</div>
          </Link>
        );
      })}
      <Link href="/substation/findings?status=open" className="col-span-2 px-4 pb-3 pt-4 transition hover:bg-ink-800/70 sm:col-span-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cx('font-mono text-3xl font-semibold tabular-nums', summary.unacknowledged ? 'text-slate-100' : 'text-slate-500')}
          >
            {summary.unacknowledged}
          </span>
        </div>
        <div className="mt-1 text-xs leading-snug text-slate-400">{t('substation.overview.unacknowledged')}</div>
      </Link>
    </div>
  );
}
