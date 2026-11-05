'use client';

import Link from 'next/link';
import { PriorityDot } from '@/components/substation/Priority';
import { cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { PRIORITY_BORDER, PRIORITY_SOFT } from '@/lib/substation';
import type { Asset, Priority } from '@/lib/types';

/** An asset's condition: its most severe open finding, normal once inspected, or nothing yet. */
export const condition = (a: Pick<Asset, 'priority' | 'last_inspected'>): Priority | null => a.priority ?? (a.last_inspected ? 0 : null);

/** Equipment along a feeder, from the busbar outwards, as a single-line diagram draws it. */
const FEEDER_ORDER = [
  'busbar',
  'disconnector',
  'breaker',
  'current_transformer',
  'voltage_transformer',
  'connector',
  'cable_termination',
  'surge_arrester',
  'bushing',
  'transformer',
  'capacitor',
  'reactor',
  'insulator',
  'other',
];
const feederRank = (kind: string) => {
  const i = FEEDER_ORDER.indexOf(kind);
  return i < 0 ? FEEDER_ORDER.length : i;
};

/**
 * The site's equipment as a single-line diagram reads, turned on its side: the busbar down the left,
 * a feeder per bay, the equipment of the bay along it in order from the bus, each marked with its
 * condition. A piece of equipment opens its page.
 */
export function BayMatrix({ assets }: { assets: Asset[] }) {
  const { t, tx } = useI18n();
  const bays = new Map<string, Asset[]>();
  for (const a of [...assets].sort(
    (x, y) => feederRank(x.kind) - feederRank(y.kind) || x.tag.localeCompare(y.tag, undefined, { numeric: true }),
  )) {
    bays.set(a.bay, [...(bays.get(a.bay) ?? []), a]);
  }
  const rows = [...bays.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, undefined, { numeric: true })));
  return (
    <div>
      <ol className="relative space-y-1 pl-5 before:absolute before:bottom-3 before:left-1 before:top-3 before:w-[3px] before:rounded-full before:bg-slate-500/70">
        {rows.map(([bay, list]) => {
          const kv = [...new Set(list.map((a) => a.voltage_kv).filter((v): v is number => v !== null))].sort((a, b) => b - a);
          const worst = list.reduce<Priority | null>((w, a) => {
            const c = condition(a);
            return c ? (w ? (Math.min(w, c) as Priority) : c) : w;
          }, null);
          return (
            <li
              key={bay || '-'}
              className="relative grid items-center gap-x-3 gap-y-1 py-1 before:absolute before:-left-4 before:top-[1.15rem] before:h-px before:w-3.5 before:bg-slate-500/70 sm:grid-cols-[11rem_1fr]"
            >
              <div className="min-w-0">
                <h3 className={cx('truncate text-sm font-medium', worst ? 'text-slate-100' : 'text-slate-300')}>
                  {bay || t('substation.assets.noBay')}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {kv.length ? `${kv.join(' / ')} kV · ` : ''}
                  {list.length === 1 ? t('substation.overview.assetCountOne') : t('substation.overview.assetCount', { n: list.length })}
                </p>
              </div>
              <ul className="flex flex-wrap items-center gap-y-1.5">
                {list.map((a, i) => (
                  <Equipment key={a.id} asset={a} first={i === 0} kind={tx('substation.kinds', a.kind)} />
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-600 pt-3 text-[11px] text-slate-500">
        {([1, 2, 3, 4, 0] as Priority[]).map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <PriorityDot p={p} className="h-2 w-2" />
            {p ? `P${p}` : t('substation.normal')}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <PriorityDot p={null} className="h-2 w-2" />
          {t('substation.notInspected')}
        </li>
      </ul>
    </div>
  );
}

/** One piece of equipment on its feeder: tag and condition, its name and kind on hover. */
function Equipment({ asset: a, first, kind }: { asset: Asset; first: boolean; kind: string }) {
  const { t } = useI18n();
  const c = condition(a);
  const state = c === null ? t('substation.notInspected') : c ? `P${c}` : t('substation.normal');
  return (
    <li
      className={cx(
        'relative',
        !first && 'ml-3 before:absolute before:right-full before:top-1/2 before:h-px before:w-3 before:bg-slate-500/60',
      )}
    >
      <Link
        href={`/substation/assets/${a.id}`}
        title={`${a.tag} · ${a.name} · ${kind}`}
        aria-label={`${a.tag}, ${a.name}: ${state}`}
        className={cx(
          'flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] font-semibold transition hover:border-accent',
          c === null
            ? 'border-dashed border-ink-500 text-slate-500'
            : c
              ? cx(PRIORITY_BORDER[c], PRIORITY_SOFT[c])
              : 'border-ink-500 bg-ink-800/60 text-slate-200',
        )}
      >
        {a.tag}
        {c ? <span className="font-sans text-[10px] font-bold">P{c}</span> : <PriorityDot p={c} className="h-1.5 w-1.5" />}
      </Link>
    </li>
  );
}
