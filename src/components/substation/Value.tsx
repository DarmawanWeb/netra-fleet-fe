import { cx } from '@/components/ui';

/** A reading such as "58.7 °C" or "23.0 dB": the number in figures, the unit smaller beside it. */
export function Value({ text, className, unitClassName }: { text: string; className?: string; unitClassName?: string }) {
  const at = text.lastIndexOf(' ');
  if (at < 0) return <span className={cx('tabular-nums', className)}>{text}</span>;
  return (
    <span className={cx('whitespace-nowrap tabular-nums tracking-tight', className)}>
      {text.slice(0, at)}
      <span className={cx('ml-0.5 font-sans font-normal text-[0.7em] opacity-70', unitClassName)}>{text.slice(at + 1)}</span>
    </span>
  );
}
