'use client';

import Link from 'next/link';
import { PriorityChip } from '@/components/substation/Priority';
import { Value } from '@/components/substation/Value';
import { cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useFmt } from '@/lib/format';
import { PRIORITY_BORDER, findingValue, signed } from '@/lib/substation';
import type { Finding } from '@/lib/types';
import { FindingThumb } from './FindingThumb';

/** What a finding's reading means in a few words: "+18.1 °C over similar", "at its rating", "partial discharge". */
export function useBasisText() {
  const { t, tx } = useI18n();
  return (f: Pick<Finding, 'basis' | 'last_delta_c' | 'kind'>) => {
    if (f.kind === 'pd') return t('substation.basis.pd');
    if (f.basis === 'limit') return t('substation.basis.limit');
    if (f.last_delta_c === null) return tx('substation.basis', f.basis || 'similar');
    return `${signed(f.last_delta_c)} °C ${tx('substation.basis', f.basis || 'similar')}`;
  };
}

/** A finding in a list: its latest image, priority, equipment, reading and how long it has been going on. */
export function FindingRow({ finding: f }: { finding: Finding }) {
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const basis = useBasisText();
  return (
    <Link
      href={`/substation/findings/${f.id}`}
      className={cx(
        'group flex items-stretch gap-3 rounded-md border-l-[3px] bg-ink-800/40 p-2 pr-3 transition hover:bg-ink-700/60',
        PRIORITY_BORDER[f.priority],
      )}
    >
      <FindingThumb finding={f} className="h-12 w-16 sm:h-14 sm:w-[4.7rem]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PriorityChip p={f.priority} />
          <span className="truncate text-sm font-medium text-slate-100">{f.label}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-400">
          {f.asset_tag && <span className="font-mono text-slate-300">{f.asset_tag}</span>}
          {f.asset_tag && ' · '}
          {f.point_name}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500">
          {t('substation.findings.seenTimes', { n: f.occurrences })} · {fmt.ago(f.last_seen)}
          {f.status === 'acknowledged' && <span className="text-slate-400"> · {tx('substation.status', f.status)}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Value text={findingValue(f)} className="text-lg font-semibold text-slate-100" />
        <div className="hidden text-[11px] text-slate-400 sm:block">{basis(f)}</div>
      </div>
    </Link>
  );
}
