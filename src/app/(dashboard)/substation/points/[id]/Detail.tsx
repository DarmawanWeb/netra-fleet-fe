'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { IconPlus, IconTrash } from '@/components/icons';
import { PriorityChip } from '@/components/substation/Priority';
import { RegionEditor } from '@/components/substation/RegionEditor';
import { ThermalView } from '@/components/substation/ThermalView';
import { TrendChart } from '@/components/substation/TrendChart';
import { Badge, Button, Empty, ErrorNote, Field, Input, PageTitle, Panel, Segmented, Select, Toggle, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { useRouteParam } from '@/lib/route';
import { useMe } from '@/lib/session';
import type { Inspection, PointInput, PointKind, Reference, Target } from '@/lib/types';
import { useSubstationRevision } from '../../_lib/live';
import { useQuery } from '../../_lib/query';

const DAY = 86_400_000;

const blank: PointInput = {
  name: '',
  kind: 'thermal',
  asset_id: null,
  route_id: null,
  stop_index: null,
  seq: 0,
  ptz: null,
  settings: { reference: 'auto' },
  targets: [],
  enabled: true,
};

/** Numbers typed in fields: empty is "not set". */
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
const str = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

/**
 * One inspection point: its captures and their course over time, and its definition: where the
 * robot takes it (a stop of a route), the camera pose, and what it measures (the regions of the
 * thermal image, or the partial discharge levels). `/substation/points/new` creates one.
 */
export default function PointDetail() {
  const param = useRouteParam();
  const isNew = param === 'new';
  const id = isNew ? undefined : Number(param);
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { can } = useMe();
  const editable = can('configure');
  const rev = useSubstationRevision();
  const query = useQuery();

  const point = useAsync(() => (id ? api.substation.point(id) : Promise.resolve(undefined)), [id, rev]);
  const routes = useAsync(() => api.routes.list(), []);
  const assets = useAsync(() => api.substation.assets(), []);
  const site = useAsync(() => api.substation.settings(), []);
  const captures = useAsync(
    () => (id ? api.substation.inspections({ pointId: id, limit: 12 }) : Promise.resolve([] as Inspection[])),
    [id, rev],
  );
  const trend = useAsync(
    () => (id ? api.substation.trend(id, { from: new Date(Date.now() - 30 * DAY), to: new Date() }) : Promise.resolve(undefined)),
    [id, rev],
  );

  const [form, setForm] = useState<PointInput>(blank);
  const [ptz, setPtz] = useState({ pan: '', tilt: '', zoom: '' });
  const [nums, setNums] = useState({ emissivity: '', distance: '', watch: '', alarm: '' });
  const [loadedFor, setLoadedFor] = useState<number | 'new' | undefined>();
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<'captures' | 'regions'>(isNew ? 'regions' : 'captures');
  const [captureId, setCaptureId] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  // Fill the form once per point (live refreshes keep what is being edited).
  useEffect(() => {
    const key = isNew ? 'new' : point.data?.id;
    if (key === undefined || key === loadedFor) return;
    const p = point.data ?? { ...blank };
    setForm({
      name: p.name,
      kind: p.kind,
      asset_id: p.asset_id,
      route_id: p.route_id,
      stop_index: p.stop_index,
      seq: p.seq,
      ptz: p.ptz,
      settings: p.settings,
      targets: p.targets,
      enabled: p.enabled,
    });
    setPtz({ pan: str(p.ptz?.pan_deg), tilt: str(p.ptz?.tilt_deg), zoom: str(p.ptz?.zoom) });
    setNums({
      emissivity: str(p.settings.emissivity),
      distance: str(p.settings.distance_m),
      watch: str(p.settings.watch_db),
      alarm: str(p.settings.alarm_db),
    });
    setSelected(p.targets[0]?.key);
    setLoadedFor(key);
  }, [isNew, point.data, loadedFor]);

  useEffect(() => {
    const c = Number(query?.get('capture'));
    if (c) setCaptureId(c);
  }, [query]);

  const route = useAsync(() => (form.route_id ? api.routes.get(form.route_id) : Promise.resolve(undefined)), [form.route_id]);
  const stops = useMemo(() => (route.data?.points ?? []).filter((p) => p[3] > 0), [route.data]);
  const capture = captures.data?.find((c) => c.id === captureId) ?? captures.data?.[0];
  const latestThermal = captures.data?.find((c) => c.images.includes('thermal'));

  const set = <K extends keyof PointInput>(k: K, v: PointInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setTargets = (targets: Target[]) => set('targets', targets);
  const updateTarget = (key: string, change: Partial<Target>) =>
    setTargets(form.targets.map((tg) => (tg.key === key ? { ...tg, ...change } : tg)));

  const nextKey = (list: Target[]) => {
    for (let n = list.length + 1; ; n++) if (!list.some((tg) => tg.key === `t${n}`)) return `t${n}`;
  };
  const newTarget = (): Target => {
    const key = nextKey(form.targets);
    return {
      key,
      label: t('substation.points.targetN', { n: key.slice(1) }),
      asset_id: form.asset_id,
      phase: '',
      group: '',
      roi: null,
      limit_c: null,
    };
  };
  const addPhases = () => {
    const taken = new Set(form.targets.map((tg) => tg.key));
    const phases = ['R', 'S', 'T']
      .filter((ph) => !taken.has(ph.toLowerCase()))
      .map<Target>((ph) => ({
        key: ph.toLowerCase(),
        label: t('substation.points.phaseLabel', { phase: ph }),
        asset_id: form.asset_id,
        phase: ph,
        group: 'phases',
        roi: null,
        limit_c: null,
      }));
    setTargets([...form.targets, ...phases]);
    if (phases[0]) setSelected(phases[0].key);
  };

  const save = async () => {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const pan = num(ptz.pan);
      const tilt = num(ptz.tilt);
      const zoom = num(ptz.zoom);
      const body: PointInput = {
        ...form,
        name: form.name.trim(),
        ptz:
          pan === undefined && tilt === undefined && zoom === undefined
            ? null
            : { pan_deg: pan ?? 0, tilt_deg: tilt ?? 0, zoom: zoom ?? 1 },
        settings:
          form.kind === 'pd'
            ? { watch_db: num(nums.watch), alarm_db: num(nums.alarm) }
            : { reference: form.settings.reference ?? 'auto', emissivity: num(nums.emissivity), distance_m: num(nums.distance) },
        targets: form.kind === 'pd' ? [] : form.targets,
      };
      const saved = await api.substation.savePoint(body, id);
      if (isNew) router.replace(`/substation/points/${saved.id}`);
      else {
        setLoadedFor(undefined);
        point.reload();
        setNotice(t('substation.points.saved'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm(t('substation.points.confirmDelete', { name: form.name }))) return;
    setBusy(true);
    try {
      await api.substation.removePoint(id);
      router.replace('/substation/points');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
      setBusy(false);
    }
  };

  const takeNow = async () => {
    if (!id) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const res = await api.substation.inspect(id);
      setNotice(res.msg || t('substation.points.taking'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!isNew && !point.data) return <ErrorNote error={point.error} />;
  const p = point.data;
  const thermal = form.kind === 'thermal';
  const pdLevels = site.data?.pd;

  return (
    <>
      <div className="mb-2">
        <Link href="/substation/points" className="text-sm text-accent hover:underline">
          ← {t('substation.points.title')}
        </Link>
      </div>
      <PageTitle
        title={isNew ? t('substation.points.new') : form.name || p?.name || ''}
        subtitle={
          p
            ? [
                tx('substation.pointKind', p.kind),
                p.robot_id,
                p.stop_index !== null ? t('substation.points.stopN', { n: p.stop_index + 1 }) : '',
                p.last_inspected ? t('substation.points.lastCapture', { ago: fmt.ago(p.last_inspected) }) : t('substation.notInspected'),
              ]
                .filter(Boolean)
                .join(' · ')
            : t('substation.points.newHelp')
        }
        actions={
          <>
            {p?.priority ? <PriorityChip p={p.priority} named className="text-xs" /> : null}
            {p && !p.enabled && <Badge>{t('substation.points.disabled')}</Badge>}
            {id && can('operate') && p?.route_id && (
              <Button onClick={takeNow} disabled={busy}>
                {t('substation.points.takeNow')}
              </Button>
            )}
            {id && editable && (
              <Button onClick={remove} disabled={busy} className="hover:!border-danger hover:!text-danger">
                {t('common.delete')}
              </Button>
            )}
            {editable && (
              <Button variant="primary" onClick={save} disabled={busy || !form.name.trim()}>
                {isNew ? t('substation.points.create') : t('common.save')}
              </Button>
            )}
          </>
        }
      />
      {(error || notice) && (
        <div className="mb-4">
          <ErrorNote error={error} />
          {notice && <div className="rounded border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{notice}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,1fr)]">
        <div className="space-y-4">
          <Panel
            title={view === 'regions' ? t('substation.points.regions') : t('substation.points.captures')}
            actions={
              !isNew &&
              thermal &&
              editable && (
                <Segmented<'captures' | 'regions'>
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'captures', label: t('substation.points.captures') },
                    { value: 'regions', label: t('substation.points.regions') },
                  ]}
                />
              )
            }
          >
            {view === 'regions' && thermal ? (
              <RegionEditor
                imageUrl={latestThermal ? api.substation.imageUrl(latestThermal.id, 'thermal') : undefined}
                targets={form.targets}
                selected={selected}
                onSelect={setSelected}
                onChange={setTargets}
                newTarget={newTarget}
              />
            ) : capture ? (
              <>
                <ThermalView inspection={capture} targets={p?.targets} />
                {captures.data && captures.data.length > 1 && (
                  <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {captures.data.map((c) => (
                      <li key={c.id} className="w-28 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCaptureId(c.id)}
                          aria-pressed={c.id === capture.id}
                          className={cx(
                            'block w-full rounded-md p-1 text-left ring-1 transition',
                            c.id === capture.id ? 'bg-accent/10 ring-accent' : 'ring-transparent hover:ring-ink-500',
                          )}
                        >
                          <ThermalView inspection={c} targets={p?.targets} compact bare />
                          <div className="mt-1 flex items-center justify-between gap-1">
                            <span className="truncate text-[10px] text-slate-400">{fmt.day(c.taken_at)}</span>
                            <PriorityChip p={c.priority} className="px-1 text-[10px]" />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <CaptureFacts capture={capture} />
              </>
            ) : (
              <Empty>{isNew ? t('substation.points.newHelp') : t('substation.points.noCaptures')}</Empty>
            )}
          </Panel>
          {trend.data && trend.data.samples.length > 0 && (
            <Panel title={t('substation.trendTitle')}>
              <TrendChart trend={trend.data} />
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title={t('substation.points.where')}>
            <fieldset disabled={!editable} className="min-w-0 space-y-3">
              <Field label={t('common.name')}>
                <Input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  maxLength={120}
                  placeholder={t('substation.points.namePlaceholder')}
                />
              </Field>
              {isNew && (
                <div role="group" aria-label={t('substation.points.kind')} className="space-y-1">
                  <span className="block text-xs text-slate-400">{t('substation.points.kind')}</span>
                  <Segmented<PointKind>
                    value={form.kind}
                    onChange={(k) => set('kind', k)}
                    options={[
                      { value: 'thermal', label: tx('substation.pointKind', 'thermal') },
                      { value: 'pd', label: tx('substation.pointKind', 'pd') },
                    ]}
                  />
                </div>
              )}
              <Field label={t('substation.points.asset')}>
                <Select value={form.asset_id ?? ''} onChange={(e) => set('asset_id', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">—</option>
                  {assets.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tag} · {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('common.route')}>
                <Select
                  value={form.route_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, route_id: e.target.value ? Number(e.target.value) : null, stop_index: null }))}
                >
                  <option value="">—</option>
                  {routes.data?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.robot_id})
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-[1fr_5rem] gap-3">
                <Field label={t('substation.points.stop')}>
                  <Select
                    value={form.stop_index ?? ''}
                    disabled={!form.route_id}
                    onChange={(e) => set('stop_index', e.target.value === '' ? null : Number(e.target.value))}
                  >
                    <option value="">—</option>
                    {stops.map((s, i) => (
                      <option key={i} value={i}>
                        {t('substation.points.stopN', { n: i + 1 })} · {s[0].toFixed(1)}, {s[1].toFixed(1)} m
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('substation.points.order')}>
                  <Input type="number" min={0} max={1000} value={form.seq} onChange={(e) => set('seq', Number(e.target.value) || 0)} />
                </Field>
              </div>
              <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label={t('substation.points.enabled')} />
            </fieldset>
          </Panel>

          <Panel title={t('substation.points.camera')}>
            <fieldset disabled={!editable} className="min-w-0 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label={t('substation.points.pan')}>
                  <Input
                    inputMode="decimal"
                    value={ptz.pan}
                    onChange={(e) => setPtz((x) => ({ ...x, pan: e.target.value }))}
                    placeholder="0"
                  />
                </Field>
                <Field label={t('substation.points.tilt')}>
                  <Input
                    inputMode="decimal"
                    value={ptz.tilt}
                    onChange={(e) => setPtz((x) => ({ ...x, tilt: e.target.value }))}
                    placeholder="0"
                  />
                </Field>
                <Field label={t('substation.points.zoom')}>
                  <Input
                    inputMode="decimal"
                    value={ptz.zoom}
                    onChange={(e) => setPtz((x) => ({ ...x, zoom: e.target.value }))}
                    placeholder="1"
                  />
                </Field>
              </div>
              {thermal ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('substation.points.emissivity')}>
                      <Input
                        inputMode="decimal"
                        value={nums.emissivity}
                        onChange={(e) => setNums((x) => ({ ...x, emissivity: e.target.value }))}
                        placeholder="0.95"
                      />
                    </Field>
                    <Field label={t('substation.points.distance')}>
                      <Input
                        inputMode="decimal"
                        value={nums.distance}
                        onChange={(e) => setNums((x) => ({ ...x, distance: e.target.value }))}
                        placeholder="5"
                      />
                    </Field>
                  </div>
                  <div role="group" aria-label={t('substation.points.reference')} className="space-y-1">
                    <span className="block text-xs text-slate-400">{t('substation.points.reference')}</span>
                    <div className="max-w-full overflow-x-auto">
                      <Segmented<Reference>
                        value={form.settings.reference ?? 'auto'}
                        onChange={(r) => set('settings', { ...form.settings, reference: r })}
                        options={(['auto', 'similar', 'ambient', 'both'] as Reference[]).map((r) => ({
                          value: r,
                          label: tx('substation.reference', r),
                        }))}
                      />
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">
                    {tx('substation.referenceHelp', form.settings.reference ?? 'auto')}
                  </p>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('substation.points.watchDb')}>
                      <Input
                        inputMode="decimal"
                        value={nums.watch}
                        onChange={(e) => setNums((x) => ({ ...x, watch: e.target.value }))}
                        placeholder={str(pdLevels?.watch_db)}
                      />
                    </Field>
                    <Field label={t('substation.points.alarmDb')}>
                      <Input
                        inputMode="decimal"
                        value={nums.alarm}
                        onChange={(e) => setNums((x) => ({ ...x, alarm: e.target.value }))}
                        placeholder={str(pdLevels?.alarm_db)}
                      />
                    </Field>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">{t('substation.points.pdHelp')}</p>
                </>
              )}
            </fieldset>
          </Panel>

          {thermal && (
            <Panel
              title={t('substation.points.targets')}
              actions={
                editable && (
                  <>
                    <Button className="px-2 py-1 text-xs" onClick={addPhases}>
                      {t('substation.points.addPhases')}
                    </Button>
                    <Button
                      className="flex items-center gap-1 px-2 py-1 text-xs"
                      onClick={() => {
                        const tg = newTarget();
                        setTargets([...form.targets, tg]);
                        setSelected(tg.key);
                      }}
                    >
                      <IconPlus width={14} height={14} />
                      {t('substation.points.addTarget')}
                    </Button>
                  </>
                )
              }
            >
              {form.targets.length ? (
                <ul className="space-y-2">
                  {form.targets.map((tg) => (
                    <TargetRow
                      key={tg.key}
                      target={tg}
                      selected={tg.key === selected}
                      editable={editable}
                      assets={assets.data ?? []}
                      onSelect={() => {
                        setSelected(tg.key);
                        if (editable) setView('regions');
                      }}
                      onChange={(change) => updateTarget(tg.key, change)}
                      onRemove={() => setTargets(form.targets.filter((x) => x.key !== tg.key))}
                    />
                  ))}
                </ul>
              ) : (
                <Empty>{t('substation.points.noTargets')}</Empty>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

/** One target: its name, phase and group, asset and rated temperature, and whether its region is drawn. */
function TargetRow({
  target: tg,
  selected,
  editable,
  assets,
  onSelect,
  onChange,
  onRemove,
}: {
  target: Target;
  selected: boolean;
  editable: boolean;
  assets: { id: number; tag: string }[];
  onSelect: () => void;
  onChange: (c: Partial<Target>) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  return (
    <li className={cx('rounded-md border p-2.5 transition', selected ? 'border-accent bg-accent/5' : 'border-ink-600')}>
      <fieldset disabled={!editable} className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelect}
            className={cx(
              'shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] ring-1',
              tg.roi ? 'text-slate-300 ring-ink-500' : 'text-warn ring-warn/50',
            )}
            title={tg.roi ? t('substation.points.regionDrawn') : t('substation.points.regionMissing')}
          >
            {tg.key}
          </button>
          <Input
            value={tg.label}
            onChange={(e) => onChange({ label: e.target.value })}
            maxLength={80}
            className="py-1"
            aria-label={t('substation.points.label')}
          />
          {editable && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-1 text-slate-500 hover:text-danger"
              aria-label={t('common.delete')}
            >
              <IconTrash width={15} height={15} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-[3.5rem_1fr_1.2fr_4.5rem] gap-2">
          <Input
            value={tg.phase}
            onChange={(e) => onChange({ phase: e.target.value })}
            maxLength={8}
            placeholder={t('substation.points.phase')}
            className="py-1 text-xs"
          />
          <Input
            value={tg.group}
            onChange={(e) => onChange({ group: e.target.value })}
            maxLength={32}
            placeholder={t('substation.points.group')}
            className="py-1 text-xs"
          />
          <Select
            value={tg.asset_id ?? ''}
            onChange={(e) => onChange({ asset_id: e.target.value ? Number(e.target.value) : null })}
            className="py-1 text-xs"
          >
            <option value="">{t('substation.points.pointAsset')}</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tag}
              </option>
            ))}
          </Select>
          <Input
            inputMode="decimal"
            value={str(tg.limit_c)}
            onChange={(e) => onChange({ limit_c: num(e.target.value) ?? null })}
            placeholder={t('substation.points.limit')}
            className="py-1 text-xs"
            title={t('substation.points.limitHelp')}
          />
        </div>
        {!tg.roi && <Hint>{t('substation.points.regionMissing')}</Hint>}
      </fieldset>
    </li>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-warn">{children}</p>;
}

/** Facts of a capture: when, by whom, during which patrol, the ambient air and the rating. */
function CaptureFacts({ capture: c }: { capture: Inspection }) {
  const { t } = useI18n();
  const fmt = useFmt();
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
      <div>
        <dt className="text-slate-500">{t('common.time')}</dt>
        <dd className="text-slate-200">{fmt.dateTime(c.taken_at)}</dd>
      </div>
      <div>
        <dt className="text-slate-500">{t('common.robot')}</dt>
        <dd className="text-slate-200">{c.robot_id ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-slate-500">{t('substation.points.patrol')}</dt>
        <dd className="text-slate-200">
          {c.patrol_id ? (
            <Link href={`/patrols/${c.patrol_id}`} className="text-accent hover:underline">
              #{c.patrol_id}
            </Link>
          ) : (
            t('substation.points.manual')
          )}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">{c.pd ? t('substation.points.pdLevel') : t('substation.ambient')}</dt>
        <dd className="font-mono text-slate-200">
          {c.pd
            ? `${c.pd.db.toFixed(1)} dB${c.pd.kind ? ` · ${c.pd.kind}` : ''}`
            : c.ambient_c !== null
              ? `${c.ambient_c.toFixed(1)} °C`
              : '—'}
        </dd>
      </div>
    </dl>
  );
}
