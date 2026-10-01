import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import type { Tone } from '@/lib/labels';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-ink-600 bg-ink-900/80 backdrop-blur', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-ink-600 px-4 py-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-300">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const toneClass: Record<Tone, string> = {
  ok: 'bg-ok/15 text-ok ring-ok/40',
  warn: 'bg-warn/15 text-warn ring-warn/40',
  danger: 'bg-danger/15 text-danger ring-danger/40',
  info: 'bg-accent/15 text-accent ring-accent/40',
  muted: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
};

export function Badge({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ring-1', toneClass[tone])}>{children}</span>;
}

type Variant = 'primary' | 'ghost' | 'danger' | 'ok';
const variantClass: Record<Variant, string> = {
  primary: 'bg-accent/90 text-ink-950 hover:bg-accent',
  ghost: 'border border-ink-500 text-slate-200 hover:border-accent hover:text-accent',
  danger: 'bg-danger/90 text-white hover:bg-danger',
  ok: 'bg-ok/90 text-ink-950 hover:bg-ok',
};

export function Button({ variant = 'ghost', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cx('rounded px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40', variantClass[variant], className)}
    />
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  const color = tone ? toneClass[tone].split(' ')[1] : 'text-slate-100';
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-800/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-widest text-slate-400">{label}</div>
      <div className={cx('mt-1 font-mono text-2xl font-semibold', color)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function ErrorNote({ error }: { error?: string }) {
  return error ? <div className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null;
}

const fieldClass = 'w-full rounded border border-ink-500 bg-ink-950 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-accent';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldClass, props.className)} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-slate-300">
      <span className={cx('relative h-5 w-9 rounded-full transition', checked ? 'bg-accent' : 'bg-ink-500')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded border border-ink-500 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx('rounded px-2.5 py-1 text-xs', value === o.value ? 'bg-accent text-ink-950' : 'text-slate-300 hover:text-accent')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-wide text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export { cx };
