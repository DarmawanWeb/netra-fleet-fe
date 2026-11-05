'use client';

import { useEffect, useState, type DragEvent } from 'react';
import { FloorPlanView, useMarkerScale } from '@/components/FloorPlanView';
import { IconCheck, IconLayers, IconUpload } from '@/components/icons';
import { RobotMarker, RouteLayer } from '@/components/MapLayers';
import { Badge, Button, Empty, ErrorNote, Field, Input, PageTitle, Panel, Select, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { mapToPlan } from '@/lib/geometry';
import { useAsync } from '@/lib/hooks';
import { robotTone } from '@/lib/labels';
import { useLive } from '@/lib/live';
import type { FloorPlan } from '@/lib/types';

/** What map.yaml says, read in the browser to check the pair before upload (the server parses it for real). */
interface YamlInfo {
  image?: string;
  resolution?: number;
  origin?: number[];
}

function readYaml(text: string): YamlInfo {
  const value = (key: string) => new RegExp(`^${key}\\s*:\\s*(.+?)\\s*(?:#.*)?$`, 'm').exec(text)?.[1];
  const image = value('image')?.replace(/^["']|["']$/g, '');
  const resolution = Number(value('resolution'));
  const origin = value('origin')
    ?.replace(/[[\]]/g, '')
    .split(',')
    .map((v) => Number(v.trim()));
  return {
    image,
    resolution: Number.isFinite(resolution) ? resolution : undefined,
    origin: origin && origin.length >= 2 && origin.every(Number.isFinite) ? origin : undefined,
  };
}

const baseName = (name: string) => name.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
const size = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const ext = (name: string) => name.toLowerCase().split('.').pop() ?? '';
const deg = (rad: number) => (rad * 180) / Math.PI;

/** Free, occupied and unknown as the server renders them (rosmap); inverted with the hue kept in the dark theme. */
const SWATCHES = [
  { key: 'free', day: '#f1f5f9', night: '#0d131f' },
  { key: 'occupied', day: '#1e293b', night: '#9fb3cc' },
  { key: 'unknown', day: '#b4bdca', night: '#323b4a' },
] as const;

/**
 * Robot maps (pgm map mode): the map.yaml and map.pgm a robot saved, rendered by the server and
 * placed by their origin and resolution, so no calibration is needed. Preview with the live robots,
 * assign to robots, delete.
 */
export function RobotMaps() {
  const { t } = useI18n();
  const fmt = useFmt();
  const { telemetry, online } = useLive();
  const plans = useAsync(() => api.floorPlans.list(), []);
  const robots = useAsync(() => api.robots.list(), []);
  const routes = useAsync(() => api.routes.list(), []);
  const [selectedId, setSelectedId] = useState<number>();
  const [previewRoute, setPreviewRoute] = useState<number>();
  const preview = useAsync(() => (previewRoute ? api.routes.get(previewRoute) : Promise.resolve(undefined)), [previewRoute]);
  const [yaml, setYaml] = useState<File | null>(null);
  const [yamlInfo, setYamlInfo] = useState<YamlInfo | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [over, setOver] = useState(false);

  const list = plans.data ?? [];
  const selected = list.find((p) => p.id === selectedId) ?? list.find((p) => p.kind === 'pgm') ?? list[0];

  useEffect(() => {
    if (!yaml) return setYamlInfo(null);
    let alive = true;
    yaml
      .text()
      .then((text) => alive && setYamlInfo(readYaml(text)))
      .catch(() => alive && setYamlInfo(null));
    return () => {
      alive = false;
    };
  }, [yaml]);

  const take = (files: FileList | File[]) => {
    setError(undefined);
    for (const f of Array.from(files)) {
      if (['yaml', 'yml'].includes(ext(f.name))) {
        setYaml(f);
        setName((n) => n || baseName(f.name));
      } else if (['pgm', 'png'].includes(ext(f.name))) {
        setImage(f);
        setName((n) => n || baseName(f.name));
      } else setError(t('robotMaps.wrongFile', { name: f.name }));
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files);
  };

  const upload = async () => {
    if (!yaml || !image) return;
    setBusy(true);
    setError(undefined);
    try {
      const { id } = await api.floorPlans.uploadRobotMap(yaml, image, name.trim() || baseName(yaml.name));
      setYaml(null);
      setImage(null);
      setName('');
      setSelectedId(id);
      plans.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('floorPlans.uploadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const assign = async (robotId: string, planId: number | null) => {
    const robot = robots.data?.find((r) => r.id === robotId);
    if (!robot) return;
    await api.robots.update(robot.id, robot.name, planId);
    robots.reload();
  };

  const remove = async (plan: FloorPlan) => {
    if (!confirm(t('robotMaps.deleteConfirm', { name: plan.name }))) return;
    await api.floorPlans.remove(plan.id);
    setSelectedId(undefined);
    plans.reload();
    robots.reload();
  };

  const mismatch = yamlInfo?.image && image && baseName(yamlInfo.image) !== baseName(image.name);
  const live = (robots.data ?? []).filter((r) => (online[r.id] ?? r.online) && telemetry[r.id]?.pose);

  const uploader = (
    <Panel title={t('robotMaps.add')}>
      <div
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cx(
          'rounded-lg border border-dashed px-3 py-4 text-center transition-colors',
          over ? 'border-accent bg-accent/5' : 'border-ink-500',
        )}
      >
        <IconUpload width={22} height={22} className="mx-auto text-slate-400" aria-hidden />
        <p className="mt-2 text-xs text-slate-400">{t('robotMaps.drop')}</p>
        <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded border border-ink-500 px-2.5 py-1 text-xs text-slate-200 hover:border-accent hover:text-accent">
          {t('robotMaps.choose')}
          <input
            type="file"
            multiple
            accept=".yaml,.yml,.pgm,.png"
            className="hidden"
            onChange={(e) => (e.target.files && take(e.target.files), (e.target.value = ''))}
          />
        </label>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {[
          { label: 'map.yaml', file: yaml, hint: t('robotMaps.yamlHint') },
          { label: 'map.pgm', file: image, hint: t('robotMaps.imageHint') },
        ].map((f) => (
          <li key={f.label} className="flex items-center gap-2">
            <span
              className={cx(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                f.file ? 'bg-ok/20 text-ok' : 'border border-ink-500 text-transparent',
              )}
            >
              <IconCheck width={12} height={12} aria-hidden />
            </span>
            <span className="font-mono text-slate-400">{f.label}</span>
            <span className={cx('min-w-0 flex-1 truncate', f.file ? 'text-slate-200' : 'text-slate-500')}>
              {f.file ? `${f.file.name} · ${size(f.file.size)}` : f.hint}
            </span>
          </li>
        ))}
      </ul>
      {yamlInfo && (
        <p className="mt-2 rounded border border-ink-600 bg-ink-800/50 px-2.5 py-1.5 font-mono text-[11px] text-slate-400">
          {yamlInfo.resolution !== undefined && `${yamlInfo.resolution} m/px`}
          {yamlInfo.origin && ` · origin ${yamlInfo.origin.map((v) => v.toFixed(2)).join(', ')}`}
          {yamlInfo.image && ` · ${yamlInfo.image}`}
        </p>
      )}
      {mismatch && <p className="mt-2 text-xs text-warn">{t('robotMaps.mismatch', { yaml: yamlInfo!.image!, image: image!.name })}</p>}
      <div className="mt-3 space-y-3">
        <Field label={t('robotMaps.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={t('robotMaps.namePlaceholder')} />
        </Field>
        <ErrorNote error={error} />
        <Button variant="primary" disabled={!yaml || !image || busy} onClick={upload} className="w-full">
          {busy ? t('robotMaps.uploading') : t('robotMaps.upload')}
        </Button>
      </div>
    </Panel>
  );

  return (
    <>
      <PageTitle title={t('robotMaps.title')} subtitle={t('robotMaps.subtitle')} />
      <ErrorNote error={plans.error} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-2">
          {selected ? (
            <>
              <FloorPlanView plan={selected} className="h-[calc(100vh-230px)] min-h-[480px]">
                {preview.data?.points && <RouteLayer plan={selected} points={preview.data.points} />}
                <OriginAxes plan={selected} />
                {live.map((r) => (
                  <RobotMarker key={r.id} plan={selected} pose={telemetry[r.id]!.pose!} name={r.name} tone={robotTone(telemetry[r.id])} />
                ))}
              </FloorPlanView>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                {selected.kind === 'pgm' &&
                  SWATCHES.map((s) => (
                    <span key={s.key} className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-sm border border-ink-500 bg-[var(--day)] dark:bg-[var(--night)]"
                        style={{ ['--day' as string]: s.day, ['--night' as string]: s.night }}
                      />
                      {t(`robotMaps.cells.${s.key}`)}
                    </span>
                  ))}
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 bg-red-500" />
                  <span className="h-0.5 w-3 bg-green-500" />
                  {t('robotMaps.axes')}
                </span>
              </div>
            </>
          ) : (
            <Panel>
              <Empty>
                <IconLayers width={28} height={28} className="mx-auto mb-2 text-slate-500" aria-hidden />
                {t('robotMaps.empty')}
              </Empty>
            </Panel>
          )}
        </div>
        <div className="space-y-4">
          {list.length > 1 && (
            <Panel title={t('robotMaps.maps')}>
              <ul className="space-y-1.5">
                {list.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelectedId(p.id)}
                      className={cx(
                        'flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left text-sm',
                        p.id === selected?.id ? 'border-accent bg-accent/5' : 'border-ink-600 hover:border-ink-500',
                      )}
                    >
                      <span className="min-w-0 truncate text-slate-100">{p.name}</span>
                      <Badge tone={p.kind === 'pgm' ? 'info' : 'muted'}>
                        {p.kind === 'pgm' ? t('robotMaps.kindPgm') : t('robotMaps.kindPlan')}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {selected && (
            <Panel
              title={t('robotMaps.details')}
              actions={
                <Badge tone={selected.kind === 'pgm' ? 'info' : 'muted'}>
                  {selected.kind === 'pgm' ? t('robotMaps.kindPgm') : t('robotMaps.kindPlan')}
                </Badge>
              }
            >
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-100">{selected.name}</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {(selected.kind === 'pgm' && selected.resolution && selected.origin
                    ? [
                        [t('robotMaps.resolution'), `${selected.resolution} m/px (${(selected.resolution * 100).toFixed(1)} cm)`],
                        [
                          t('robotMaps.size'),
                          `${selected.width_px} × ${selected.height_px} px · ${(selected.width_px * selected.resolution).toFixed(1)} × ${(selected.height_px * selected.resolution).toFixed(1)} m`,
                        ],
                        [
                          t('robotMaps.origin'),
                          `x ${selected.origin[0].toFixed(2)} m, y ${selected.origin[1].toFixed(2)} m, ${deg(selected.origin[2]).toFixed(1)}°`,
                        ],
                      ]
                    : [
                        [t('floorPlans.scale'), `${selected.px_per_m.toFixed(2)}`],
                        [t('robotMaps.size'), `${selected.width_px} × ${selected.height_px} px`],
                      ]
                  ).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-slate-400">{k}</dt>
                      <dd className="font-mono text-xs leading-5 text-slate-200">{v}</dd>
                    </div>
                  ))}
                  <dt className="text-slate-400">{t('robotMaps.added')}</dt>
                  <dd className="text-slate-200">{fmt.dateTime(selected.created_at)}</dd>
                </dl>
                <p className="text-xs leading-relaxed text-slate-500">
                  {selected.kind === 'pgm' ? t('robotMaps.placedByYaml') : t('robotMaps.oldPlan')}
                </p>
                <Field label={t('robotMaps.previewRoute')}>
                  <Select value={previewRoute ?? ''} onChange={(e) => setPreviewRoute(Number(e.target.value) || undefined)}>
                    <option value="">{t('floorPlans.noRoute')}</option>
                    {routes.data?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.robot_id} · {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button variant="danger" onClick={() => remove(selected)}>
                  {t('common.delete')}
                </Button>
              </div>
            </Panel>
          )}
          {selected && (
            <Panel title={t('robotMaps.robotsOnMap')}>
              <div className="space-y-2 text-sm">
                {robots.data?.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-slate-200">
                    <span className="truncate">{r.name}</span>
                    {r.floor_plan_id === selected.id ? (
                      <span className="text-xs text-ok">{t('floorPlans.assigned')}</span>
                    ) : (
                      <Button onClick={() => assign(r.id, selected.id)}>{t('floorPlans.assign')}</Button>
                    )}
                  </div>
                ))}
                {!robots.data?.length && <p className="text-xs text-slate-500">{t('map.noRobots')}</p>}
              </div>
            </Panel>
          )}
          {uploader}
        </div>
      </div>
    </>
  );
}

/** The map frame origin with 1 m of its x (red) and y (green) axes, so the placement can be checked. */
function OriginAxes({ plan }: { plan: FloorPlan }) {
  const o = mapToPlan(plan, 0, 0);
  const x = mapToPlan(plan, 1, 0);
  const y = mapToPlan(plan, 0, 1);
  const s = useMarkerScale(plan.px_per_m);
  return (
    <g pointerEvents="none">
      <line x1={o.px} y1={o.py} x2={x.px} y2={x.py} stroke="#ef4444" strokeWidth={2.5 * s} />
      <line x1={o.px} y1={o.py} x2={y.px} y2={y.py} stroke="#22c55e" strokeWidth={2.5 * s} />
      <circle cx={o.px} cy={o.py} r={3.5 * s} fill="#22d3ee" stroke="#05080f" strokeWidth={1.5 * s} />
    </g>
  );
}
