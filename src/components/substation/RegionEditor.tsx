'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react';
import { cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import type { Region, Target } from '@/lib/types';

type Corner = 'nw' | 'ne' | 'sw' | 'se';
type Drag =
  | { mode: 'draw'; key: string; x0: number; y0: number }
  | { mode: 'move'; key: string; x0: number; y0: number; roi: Region }
  | { mode: 'resize'; key: string; corner: Corner; roi: Region };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const MIN = 0.01;

/** A box from two corners, inside the image. */
function box(ax: number, ay: number, bx: number, by: number): Region {
  const x = clamp(Math.min(ax, bx));
  const y = clamp(Math.min(ay, by));
  return { x, y, w: Math.max(MIN, clamp(Math.max(ax, bx)) - x), h: Math.max(MIN, clamp(Math.max(ay, by)) - y) };
}

/**
 * Draws the targets' regions on the point's thermal image: drag on the image to draw the selected
 * target's region (or a new target's), drag a region to move it, its corners to resize it. Arrow
 * keys nudge the selected region, with Shift they resize it; Delete removes it.
 */
export function RegionEditor({
  imageUrl,
  targets,
  selected,
  onSelect,
  onChange,
  newTarget,
}: {
  imageUrl?: string;
  targets: Target[];
  selected?: string;
  onSelect: (key: string) => void;
  onChange: (targets: Target[]) => void;
  /** A target to add when drawing without one selected. */
  newTarget: () => Target;
}) {
  const { t } = useI18n();
  const area = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ratio, setRatio] = useState(4 / 3);

  const at = (e: ReactPointerEvent) => {
    const r = area.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };
  const setRoi = (key: string, roi: Region | null, list = targets) => onChange(list.map((tg) => (tg.key === key ? { ...tg, roi } : tg)));

  const start = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const p = at(e);
    let list = targets;
    let key = selected && targets.some((tg) => tg.key === selected) ? selected : undefined;
    if (!key) {
      const fresh = newTarget();
      list = [...targets, fresh];
      key = fresh.key;
      onSelect(key);
    }
    area.current!.setPointerCapture(e.pointerId);
    setDrag({ mode: 'draw', key, x0: p.x, y0: p.y });
    setRoi(key, { x: p.x, y: p.y, w: MIN, h: MIN }, list);
  };

  const grab = (e: ReactPointerEvent, tg: Target, corner?: Corner) => {
    e.stopPropagation();
    if (e.button !== 0 || !tg.roi) return;
    onSelect(tg.key);
    area.current!.setPointerCapture(e.pointerId);
    const p = at(e);
    setDrag(corner ? { mode: 'resize', key: tg.key, corner, roi: tg.roi } : { mode: 'move', key: tg.key, x0: p.x, y0: p.y, roi: tg.roi });
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const p = at(e);
    if (drag.mode === 'draw') setRoi(drag.key, box(drag.x0, drag.y0, p.x, p.y));
    else if (drag.mode === 'move') {
      const { roi } = drag;
      setRoi(drag.key, {
        ...roi,
        x: Math.min(1 - roi.w, Math.max(0, roi.x + p.x - drag.x0)),
        y: Math.min(1 - roi.h, Math.max(0, roi.y + p.y - drag.y0)),
      });
    } else {
      const { roi, corner } = drag;
      const fx = corner === 'nw' || corner === 'sw' ? roi.x + roi.w : roi.x;
      const fy = corner === 'nw' || corner === 'ne' ? roi.y + roi.h : roi.y;
      setRoi(drag.key, box(fx, fy, p.x, p.y));
    }
  };

  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const tg = targets.find((x) => x.key === selected);
    if (!tg?.roi) return;
    const step = e.altKey ? 0.002 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setRoi(tg.key, null);
      return;
    }
    if (!d) return;
    e.preventDefault();
    const r = tg.roi;
    setRoi(
      tg.key,
      e.shiftKey
        ? { ...r, w: Math.max(MIN, Math.min(1 - r.x, r.w + d[0]!)), h: Math.max(MIN, Math.min(1 - r.y, r.h + d[1]!)) }
        : { ...r, x: Math.min(1 - r.w, Math.max(0, r.x + d[0]!)), y: Math.min(1 - r.h, Math.max(0, r.y + d[1]!)) },
    );
  };

  return (
    <div className="space-y-2">
      <div
        ref={area}
        tabIndex={0}
        role="application"
        aria-label={t('substation.points.regionsHelp')}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={key}
        className="relative cursor-crosshair touch-none select-none overflow-hidden rounded-md bg-black outline-none ring-accent focus-visible:ring-2"
        style={{ aspectRatio: ratio }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            onLoad={(e) => e.currentTarget.naturalWidth && setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
          />
        ) : (
          <div className="thermal-empty absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[size:10%_10%]" />
          </div>
        )}
        {targets.map((tg) => {
          if (!tg.roi) return null;
          const active = tg.key === selected;
          return (
            <div
              key={tg.key}
              onPointerDown={(e) => grab(e, tg)}
              className={cx(
                'absolute cursor-move border-2',
                active ? 'border-accent bg-accent/10' : 'border-white/80 border-dashed bg-transparent hover:border-white',
              )}
              style={{ left: `${tg.roi.x * 100}%`, top: `${tg.roi.y * 100}%`, width: `${tg.roi.w * 100}%`, height: `${tg.roi.h * 100}%` }}
            >
              <span
                className={cx(
                  'absolute -top-px left-0 -translate-y-full whitespace-nowrap rounded-t-sm px-1 py-px text-[10px] font-medium leading-tight',
                  active ? 'bg-accent text-ink-950' : 'bg-black/70 text-white',
                )}
              >
                {tg.label || tg.key}
              </span>
              {active &&
                (['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                  <span
                    key={c}
                    onPointerDown={(e) => grab(e, tg, c)}
                    className={cx(
                      'absolute h-3 w-3 rounded-sm border border-ink-950 bg-accent',
                      c[0] === 'n' ? '-top-1.5' : '-bottom-1.5',
                      c[1] === 'w' ? '-left-1.5' : '-right-1.5',
                      c === 'nw' || c === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize',
                    )}
                  />
                ))}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">{t('substation.points.regionsHelp')}</p>
    </div>
  );
}
