'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWidth } from '@/app/(dashboard)/dashboard/_components/chart';
import { cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { celsius, priorityColor } from '@/lib/substation';
import type { Inspection, InspectionImage, Priority, Target, ThermalResult } from '@/lib/types';

interface Region {
  key: string;
  label: string;
  roi: NonNullable<Target['roi']>;
  result?: ThermalResult;
}

/**
 * A capture as the robot saw it: the thermal image (or the visual or acoustic one) with each
 * target's region, its hottest temperature, and the rated ones outlined in their priority colour.
 * Below, the ironbow scale from the coolest to the hottest reading with a mark per target.
 */
export function ThermalView({
  inspection,
  targets = [],
  highlight,
  compact,
  bare,
  className,
}: {
  inspection?: Inspection | null;
  targets?: Target[];
  /** The target to emphasise (a finding's). */
  highlight?: string;
  /** Card: no switch, no scale, the temperature of rated targets only. */
  compact?: boolean;
  /** Small thumbnail: regions without labels. */
  bare?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const images = inspection?.images ?? [];
  const preferred: InspectionImage = inspection?.kind === 'pd' ? 'acoustic' : 'thermal';
  const [shown, setShown] = useState<InspectionImage | undefined>();
  const [ratio, setRatio] = useState(4 / 3);
  const [frame, width] = useWidth<HTMLDivElement>();
  // Under ~560 px the names of side-by-side regions collide: keep the temperature, and the name of the emphasised one.
  const narrow = width > 0 && width < 560;
  useEffect(() => setShown(undefined), [inspection?.id]);
  const image = shown && images.includes(shown) ? shown : images.includes(preferred) ? preferred : images[0];

  const regions = useMemo<Region[]>(() => {
    const results = new Map((inspection?.thermal ?? []).map((r) => [r.key, r]));
    return targets
      .filter((tg) => tg.roi)
      .map((tg) => ({ key: tg.key, label: tg.label || tg.key, roi: tg.roi!, result: results.get(tg.key) }));
  }, [inspection?.thermal, targets]);

  const scale = useMemo(() => {
    const temps = (inspection?.thermal ?? []).map((r) => r.max_c);
    if (inspection?.ambient_c !== null && inspection?.ambient_c !== undefined) temps.push(inspection.ambient_c);
    if (temps.length < 2) return null;
    const lo = Math.floor(Math.min(...temps) - 1);
    const hi = Math.ceil(Math.max(...temps) + 1);
    return { lo, hi, at: (v: number) => ((v - lo) / (hi - lo)) * 100 };
  }, [inspection?.thermal, inspection?.ambient_c]);

  const ambient = inspection?.ambient_c ?? null;
  const showRegions = image === 'thermal' || image === 'visual' || image === undefined;

  return (
    <figure className={cx('space-y-2', className)}>
      <div ref={frame} className="relative overflow-hidden rounded-md bg-black" style={{ aspectRatio: ratio }}>
        {image && inspection ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${inspection.id}-${image}`}
            src={api.substation.imageUrl(inspection.id, image)}
            alt={t(`substation.image.${image}`)}
            className="absolute inset-0 h-full w-full object-cover"
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              if (w && h) setRatio(w / h);
            }}
          />
        ) : (
          <div className="thermal-empty absolute inset-0 flex items-center justify-center">
            {!compact && <span className="rounded bg-black/40 px-2 py-1 text-xs text-white/70">{t('substation.noImage')}</span>}
          </div>
        )}
        {showRegions && regions.length > 0 && (
          <>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
              {regions.map((r) => {
                const p = (r.result?.priority ?? 0) as Priority;
                const strong = r.key === highlight || p !== 0;
                return (
                  <rect
                    key={r.key}
                    x={r.roi.x * 100}
                    y={r.roi.y * 100}
                    width={r.roi.w * 100}
                    height={r.roi.h * 100}
                    fill={r.key === highlight ? priorityColor(p) : 'none'}
                    fillOpacity={r.key === highlight ? 0.14 : undefined}
                    stroke={p ? priorityColor(p) : 'rgb(255 255 255 / 0.75)'}
                    strokeWidth={r.key === highlight ? 2.5 : strong ? 2 : 1}
                    strokeDasharray={strong ? undefined : '4 3'}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
            {regions
              .filter((r) => !bare && (!compact || (r.result?.priority ?? 0) !== 0 || r.key === highlight))
              .map((r) => {
                const p = (r.result?.priority ?? 0) as Priority;
                // On a narrow image the emphasised label goes under its region, clear of its neighbours' temperatures.
                const above = r.roi.y > 0.12 && !(narrow && r.key === highlight && r.roi.y + r.roi.h < 0.85);
                // A label sits on its region's left edge, centre or right edge by where the region is, so it stays in the image.
                const middle = r.roi.x + r.roi.w / 2;
                const side = middle < 0.38 ? 'left' : middle > 0.62 ? 'right' : 'centre';
                const dy = above ? 'calc(-100% - 3px)' : '3px';
                return (
                  <div
                    key={r.key}
                    className="pointer-events-none absolute whitespace-nowrap"
                    style={{
                      ...(side === 'right'
                        ? { right: `${(1 - r.roi.x - r.roi.w) * 100}%` }
                        : { left: `${(side === 'left' ? r.roi.x : middle) * 100}%` }),
                      top: above ? `${r.roi.y * 100}%` : `${(r.roi.y + r.roi.h) * 100}%`,
                      transform: side === 'centre' ? `translate(-50%, ${dy})` : `translateY(${dy})`,
                    }}
                  >
                    <span
                      className={cx(
                        'inline-flex items-baseline gap-1 rounded-sm px-1 py-px font-mono leading-none shadow',
                        compact ? 'text-[9px]' : 'text-[11px]',
                        p ? 'text-white' : 'bg-black/65 text-white',
                      )}
                      style={p ? { background: priorityColor(p) } : undefined}
                    >
                      {!compact && (!narrow || r.key === highlight) && <span className="font-sans font-medium opacity-90">{r.label}</span>}
                      {r.result && <span className="font-semibold tabular-nums">{r.result.max_c.toFixed(1)}°</span>}
                    </span>
                  </div>
                );
              })}
          </>
        )}
        {!compact && images.length > 1 && (
          <div className="absolute right-2 top-2 flex rounded border border-white/20 bg-black/55 p-0.5 backdrop-blur">
            {images.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setShown(name)}
                aria-pressed={image === name}
                className={cx(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition',
                  image === name ? 'bg-white text-black' : 'text-white/80 hover:text-white',
                )}
              >
                {t(`substation.image.${name}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      {!compact && scale && image === 'thermal' && (
        <figcaption className="px-0.5">
          <div className="relative h-2 rounded-full ironbow">
            {ambient !== null && (
              <span
                aria-hidden
                className="absolute -bottom-1 h-1.5 w-px -translate-x-1/2 bg-slate-400"
                style={{ left: `${scale.at(ambient)}%` }}
              />
            )}
            {(inspection?.thermal ?? []).map((r) => (
              <span
                key={r.key}
                title={`${r.label} ${celsius(r.max_c)}`}
                className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-black/40"
                style={{ left: `${scale.at(r.max_c)}%`, background: r.priority ? priorityColor(r.priority) : '#fff' }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between gap-2 text-[10px] tabular-nums text-slate-500">
            <span>{scale.lo} °C</span>
            {ambient !== null && <span className="text-slate-400">{t('substation.ambientValue', { v: ambient.toFixed(1) })}</span>}
            <span>{scale.hi} °C</span>
          </div>
        </figcaption>
      )}
    </figure>
  );
}
