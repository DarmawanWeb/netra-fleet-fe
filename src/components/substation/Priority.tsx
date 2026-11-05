'use client';

import { cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { PRIORITY_BG, PRIORITY_SOFT } from '@/lib/substation';
import type { Priority } from '@/lib/types';

/** "P1" in its colour, or "Normal"; with `named`, the short NETA action after it. */
export function PriorityChip({ p, named, className }: { p: Priority | null | undefined; named?: boolean; className?: string }) {
  const { t, tx } = useI18n();
  const v = (p ?? 0) as Priority;
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1',
        PRIORITY_SOFT[v],
        className,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', PRIORITY_BG[v])} aria-hidden />
      {v ? `P${v}` : t('substation.normal')}
      {named && v !== 0 && <span className="font-medium opacity-90">{tx('substation.short', String(v))}</span>}
    </span>
  );
}

/** A small round mark of a condition (null: not inspected yet). */
export function PriorityDot({ p, className }: { p: Priority | null | undefined; className?: string }) {
  return (
    <span
      className={cx(
        'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
        p === null || p === undefined ? 'bg-slate-600' : PRIORITY_BG[p],
        className,
      )}
      aria-hidden
    />
  );
}
