import type { ReactNode } from 'react';
import { IconAlert, IconCheck, IconOctagon } from '@/components/icons';
import { cx } from '@/components/ui';

export interface Readout {
  key: string;
  label: string;
  value: ReactNode;
  /** Small text after the value, e.g. "of 3". */
  suffix?: string;
  hint: string;
  /** Status of the figure; shown with an icon, never by colour alone. */
  tone?: 'ok' | 'warn' | 'danger';
}

const TONE = {
  ok: { text: 'text-ok', Icon: IconCheck },
  warn: { text: 'text-warn', Icon: IconAlert },
  danger: { text: 'text-danger', Icon: IconOctagon },
};

/** The situation line on top of the map: a few figures read at a glance, separated by hairlines. */
export function Readouts({ items }: { items: Readout[] }) {
  return (
    <div className="flex flex-wrap gap-px bg-ink-600">
      {items.map((r) => {
        const tone = r.tone ? TONE[r.tone] : null;
        return (
          <div key={r.key} className="min-w-[9.5rem] flex-1 bg-ink-900 px-4 py-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {tone && <tone.Icon width={14} height={14} className={tone.text} aria-hidden />}
              <span className="truncate">{r.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={cx('text-[26px] font-semibold leading-8', tone?.text ?? 'text-slate-100')}>{r.value}</span>
              {r.suffix && <span className="text-xs text-slate-500">{r.suffix}</span>}
            </div>
            <div className="truncate text-xs text-slate-500" title={r.hint}>
              {r.hint}
            </div>
          </div>
        );
      })}
    </div>
  );
}
