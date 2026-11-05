'use client';

import type { ReactNode } from 'react';
import { IconPin, IconPlus, IconRobot, IconTrash } from '@/components/icons';
import { Button, Input, Select, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { validFix } from '@/lib/geo';
import type { GpsFix, Pose } from '@/lib/types';
import { emptyRow, field, splitLatLon, type PointRow } from '../_lib/form';

export interface PositionSource {
  id: string;
  name: string;
  pose: Pose;
  gps?: GpsFix | null;
}

function IconButton({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded border transition disabled:cursor-not-allowed disabled:opacity-35',
        active ? 'border-accent bg-accent/15 text-accent' : 'border-ink-500 text-slate-300 hover:border-accent hover:text-accent',
      )}
    >
      {children}
    </button>
  );
}

const coord = 'h-8 py-1 font-mono text-xs';

/** The control point list: label, map position and latitude/longitude, filled by hand, from a robot or from the map. */
export function ControlPoints({
  rows,
  onChange,
  residuals,
  warn,
  picking,
  onPick,
  sources,
  sourceId,
  onSource,
  heading,
  onHeading,
  showHeading,
}: {
  rows: PointRow[];
  onChange: (rows: PointRow[]) => void;
  /** Residual per row key, metres. */
  residuals: Record<string, number>;
  warn: Set<string>;
  picking: string | null;
  onPick: (key: string | null) => void;
  /** Online robots with a pose. */
  sources: PositionSource[];
  sourceId: string;
  onSource: (id: string) => void;
  heading: string;
  onHeading: (v: string) => void;
  showHeading: boolean;
}) {
  const { t } = useI18n();
  const source = sources.find((s) => s.id === sourceId);
  const update = (key: string, patch: Partial<PointRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const latLonField = (key: string, which: 'lat' | 'lon', value: string) => {
    const pair = splitLatLon(value);
    update(key, pair ? { lat: pair[0], lon: pair[1] } : { [which]: value });
  };
  const fromRobot = (key: string) => {
    if (!source) return;
    const patch: Partial<PointRow> = { x: field(source.pose.x, 3), y: field(source.pose.y, 3) };
    if (validFix(source.gps)) Object.assign(patch, { lat: field(source.gps.lat, 7), lon: field(source.gps.lon, 7) });
    update(key, patch);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <IconRobot width={16} height={16} aria-hidden />
        <span>{t('siteMap.positionsFrom')}</span>
        <Select
          value={source?.id ?? ''}
          onChange={(e) => onSource(e.target.value)}
          disabled={!sources.length}
          className="h-8 w-auto min-w-[9rem] flex-1 py-1 text-xs"
          aria-label={t('siteMap.positionsFrom')}
        >
          {!sources.length && <option value="">{t('siteMap.noRobotOnline')}</option>}
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.pose.x.toFixed(1)}, {s.pose.y.toFixed(1)} m{validFix(s.gps) ? ' · GPS' : ''}
            </option>
          ))}
        </Select>
      </div>

      {rows.length ? (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const residual = residuals[r.key];
            return (
              <li
                key={r.key}
                className={cx(
                  'rounded-lg border px-3 py-2.5 transition-colors',
                  picking === r.key ? 'border-accent bg-accent/5' : warn.has(r.key) ? 'border-warn/50' : 'border-ink-600',
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white dark:text-ink-950',
                      warn.has(r.key) ? 'bg-warn' : 'bg-violet-600 dark:bg-violet-400',
                    )}
                  >
                    {i + 1}
                  </span>
                  <Input
                    value={r.label}
                    onChange={(e) => update(r.key, { label: e.target.value })}
                    placeholder={t('siteMap.pointN', { n: i + 1 })}
                    maxLength={64}
                    className="h-8 min-w-[8rem] flex-1 py-1"
                    aria-label={t('siteMap.label')}
                  />
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {residual !== undefined && (
                      <span
                        className={cx('shrink-0 font-mono text-xs', warn.has(r.key) ? 'text-warn' : 'text-slate-400')}
                        title={t('siteMap.residualHint')}
                      >
                        ±{residual < 10 ? residual.toFixed(2) : residual.toFixed(0)} m
                      </span>
                    )}
                    <IconButton
                      title={
                        source
                          ? t(validFix(source.gps) ? 'siteMap.useRobotGps' : 'siteMap.useRobot', { name: source.name })
                          : t('siteMap.noRobotOnline')
                      }
                      disabled={!source}
                      onClick={() => fromRobot(r.key)}
                    >
                      <IconRobot width={16} height={16} />
                    </IconButton>
                    <IconButton
                      title={t('siteMap.pickOnMap')}
                      active={picking === r.key}
                      onClick={() => onPick(picking === r.key ? null : r.key)}
                    >
                      <IconPin width={16} height={16} />
                    </IconButton>
                    <IconButton
                      title={t('siteMap.removePoint')}
                      onClick={() => (picking === r.key && onPick(null), onChange(rows.filter((x) => x.key !== r.key)))}
                    >
                      <IconTrash width={16} height={16} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5">
                  <span className="text-[11px] text-slate-500">{t('siteMap.mapXY')}</span>
                  <Input
                    value={r.x}
                    onChange={(e) => update(r.key, { x: e.target.value })}
                    inputMode="decimal"
                    placeholder="x"
                    className={coord}
                    aria-label={t('siteMap.mapX', { n: i + 1 })}
                  />
                  <Input
                    value={r.y}
                    onChange={(e) => update(r.key, { y: e.target.value })}
                    inputMode="decimal"
                    placeholder="y"
                    className={coord}
                    aria-label={t('siteMap.mapY', { n: i + 1 })}
                  />
                  <span className="text-[11px] text-slate-500">{t('siteMap.latLon')}</span>
                  <Input
                    value={r.lat}
                    onChange={(e) => latLonField(r.key, 'lat', e.target.value)}
                    inputMode="decimal"
                    placeholder={t('siteMap.lat')}
                    className={coord}
                    aria-label={t('siteMap.latN', { n: i + 1 })}
                  />
                  <Input
                    value={r.lon}
                    onChange={(e) => latLonField(r.key, 'lon', e.target.value)}
                    inputMode="decimal"
                    placeholder={t('siteMap.lon')}
                    className={coord}
                    aria-label={t('siteMap.lonN', { n: i + 1 })}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-lg border border-dashed border-ink-500 px-3 py-4 text-sm text-slate-400">{t('siteMap.noPoints')}</p>
      )}

      {showHeading && (
        <label className="block space-y-1 rounded-lg border border-ink-600 px-3 py-2.5">
          <span className="text-xs text-slate-300">{t('siteMap.heading')}</span>
          <Input
            value={heading}
            onChange={(e) => onHeading(e.target.value)}
            inputMode="decimal"
            placeholder="0–360"
            className="h-8 w-32 py-1 font-mono text-xs"
          />
          <span className="block text-[11px] text-slate-500">{t('siteMap.headingHelp')}</span>
        </label>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={() => onChange([...rows, emptyRow()])} className="flex items-center gap-1.5">
          <IconPlus width={15} height={15} aria-hidden /> {t('siteMap.addPoint')}
        </Button>
        <span className="text-[11px] text-slate-500">{t('siteMap.pasteHint')}</span>
      </div>
    </div>
  );
}
