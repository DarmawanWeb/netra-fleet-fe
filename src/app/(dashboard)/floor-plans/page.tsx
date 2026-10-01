'use client';

import { useEffect, useState } from 'react';
import { FloorPlanView } from '@/components/FloorPlanView';
import { RouteLayer } from '@/components/MapLayers';
import { Button, Empty, ErrorNote, Field, Input, PageTitle, Panel, Segmented, Select } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { mapToPlan } from '@/lib/geometry';
import { useAsync } from '@/lib/hooks';
import type { FloorPlan } from '@/lib/types';
import { readPlanFile } from './_components/readPlanFile';

type Mode = 'origin' | 'scale' | 'view';

export default function FloorPlansPage() {
  const { t } = useI18n();
  const plans = useAsync(() => api.floorPlans.list(), []);
  const robots = useAsync(() => api.robots.list(), []);
  const routes = useAsync(() => api.routes.list(), []);
  const [selectedId, setSelectedId] = useState<number>();
  const [draft, setDraft] = useState<FloorPlan>();
  const [mode, setMode] = useState<Mode>('origin');
  const [scalePts, setScalePts] = useState<{ px: number; py: number }[]>([]);
  const [distance, setDistance] = useState('10');
  const [previewRoute, setPreviewRoute] = useState<number>();
  const preview = useAsync(() => (previewRoute ? api.routes.get(previewRoute) : Promise.resolve(undefined)), [previewRoute]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const plan = plans.data?.find((p) => p.id === selectedId) ?? plans.data?.[0];
    setDraft(plan ? { ...plan } : undefined);
    setScalePts([]);
  }, [plans.data, selectedId]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(undefined);
    try {
      const prepared = await readPlanFile(file);
      const { id } = await api.floorPlans.upload(
        prepared.blob,
        prepared.filename,
        file.name.replace(/\.[^.]+$/, ''),
        prepared.width,
        prepared.height,
      );
      setSelectedId(id);
      plans.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('floorPlans.uploadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const onPlanClick = (px: number, py: number) => {
    if (!draft) return;
    if (mode === 'origin') setDraft({ ...draft, origin_x_px: px, origin_y_px: py });
    if (mode === 'scale') setScalePts((pts) => (pts.length >= 2 ? [{ px, py }] : [...pts, { px, py }]));
  };

  const applyScale = () => {
    const [a, b] = scalePts;
    const meters = Number(distance);
    if (!draft || !a || !b || !(meters > 0)) return;
    setDraft({ ...draft, px_per_m: Math.hypot(b.px - a.px, b.py - a.py) / meters });
    setScalePts([]);
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.floorPlans.calibrate(draft);
      plans.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  const assign = async (robotId: string) => {
    const robot = robots.data?.find((r) => r.id === robotId);
    if (!robot || !draft) return;
    await api.robots.update(robot.id, robot.name, draft.id);
    robots.reload();
  };

  const s = draft ? Math.max(draft.px_per_m / 20, 0.6) : 1;
  const axis = draft ? [mapToPlan(draft, 0, 0), mapToPlan(draft, 1, 0), mapToPlan(draft, 0, 1)] : [];

  return (
    <>
      <PageTitle
        title={t('floorPlans.title')}
        subtitle={t('floorPlans.subtitle')}
        actions={
          <label className="cursor-pointer rounded bg-accent/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent dark:text-ink-950">
            {busy ? t('floorPlans.processing') : t('floorPlans.upload')}
            <input
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
        }
      />
      <ErrorNote error={error ?? plans.error} />
      {!draft ? (
        <Panel>
          <Empty>{t('floorPlans.empty')}</Empty>
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="space-y-2">
            <Segmented<Mode>
              value={mode}
              onChange={(m) => (setMode(m), setScalePts([]))}
              options={[
                { value: 'origin', label: t('floorPlans.modeBase') },
                { value: 'scale', label: t('floorPlans.modeScale') },
                { value: 'view', label: t('floorPlans.modePan') },
              ]}
            />
            <FloorPlanView
              plan={draft}
              onPlanClick={mode === 'view' ? undefined : onPlanClick}
              className="h-[calc(100vh-230px)] min-h-[480px]"
            >
              {preview.data?.points && <RouteLayer plan={draft} points={preview.data.points} />}
              {axis.length === 3 && (
                <g>
                  <line x1={axis[0]!.px} y1={axis[0]!.py} x2={axis[1]!.px} y2={axis[1]!.py} stroke="#ef4444" strokeWidth={3 * s} />
                  <line x1={axis[0]!.px} y1={axis[0]!.py} x2={axis[2]!.px} y2={axis[2]!.py} stroke="#22c55e" strokeWidth={3 * s} />
                  <circle cx={axis[0]!.px} cy={axis[0]!.py} r={7 * s} fill="#22d3ee" stroke="#05080f" strokeWidth={2 * s} />
                  <text x={axis[0]!.px + 10 * s} y={axis[0]!.py - 10 * s} fontSize={12 * s} fill="#22d3ee">
                    BASE
                  </text>
                </g>
              )}
              {scalePts.map((p, i) => (
                <circle key={i} cx={p.px} cy={p.py} r={6 * s} fill="#f59e0b" />
              ))}
              {scalePts.length === 2 && (
                <line
                  x1={scalePts[0]!.px}
                  y1={scalePts[0]!.py}
                  x2={scalePts[1]!.px}
                  y2={scalePts[1]!.py}
                  stroke="#f59e0b"
                  strokeWidth={2 * s}
                  strokeDasharray={`${6 * s}`}
                />
              )}
            </FloorPlanView>
            <p className="text-xs text-slate-500">{t('floorPlans.axisHint')}</p>
          </div>
          <div className="space-y-4">
            {(plans.data?.length ?? 0) > 1 && (
              <Select value={draft.id} onChange={(e) => setSelectedId(Number(e.target.value))}>
                {plans.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
            <Panel title={t('floorPlans.calibration')}>
              <div className="space-y-3">
                <Field label={t('floorPlans.planName')}>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('floorPlans.baseX')}>
                    <Input
                      type="number"
                      value={draft.origin_x_px.toFixed(1)}
                      onChange={(e) => setDraft({ ...draft, origin_x_px: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label={t('floorPlans.baseY')}>
                    <Input
                      type="number"
                      value={draft.origin_y_px.toFixed(1)}
                      onChange={(e) => setDraft({ ...draft, origin_y_px: Number(e.target.value) })}
                    />
                  </Field>
                </div>
                <Field label={t('floorPlans.rotation', { deg: ((draft.rotation_rad * 180) / Math.PI).toFixed(1) })}>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={0.5}
                    value={(draft.rotation_rad * 180) / Math.PI}
                    onChange={(e) => setDraft({ ...draft, rotation_rad: (Number(e.target.value) * Math.PI) / 180 })}
                    className="w-full accent-cyan-500"
                  />
                </Field>
                <Field label={t('floorPlans.scale')}>
                  <Input
                    type="number"
                    step="0.01"
                    value={draft.px_per_m.toFixed(3)}
                    onChange={(e) => setDraft({ ...draft, px_per_m: Number(e.target.value) })}
                  />
                </Field>
                {mode === 'scale' && (
                  <div className="space-y-2 rounded border border-warn/40 p-2 text-xs text-slate-300">
                    {t('floorPlans.scaleHint', { n: scalePts.length })}
                    <div className="flex gap-2">
                      <Input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} className="w-24" />
                      <span className="self-center">{t('common.meters')}</span>
                      <Button disabled={scalePts.length !== 2} onClick={applyScale}>
                        {t('common.apply')}
                      </Button>
                    </div>
                  </div>
                )}
                <Field label={t('floorPlans.previewRoute')}>
                  <Select value={previewRoute ?? ''} onChange={(e) => setPreviewRoute(Number(e.target.value) || undefined)}>
                    <option value="">{t('floorPlans.noRoute')}</option>
                    {routes.data?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.robot_id} · {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex gap-2">
                  <Button variant="primary" disabled={busy} onClick={save}>
                    {t('floorPlans.save')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      confirm(t('floorPlans.deleteConfirm', { name: draft.name })) &&
                      api.floorPlans.remove(draft.id).then(() => (setSelectedId(undefined), plans.reload()))
                    }
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            </Panel>
            <Panel title={t('floorPlans.robotsOnPlan')}>
              <div className="space-y-2 text-sm">
                {robots.data?.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-slate-200">
                    <span>{r.name}</span>
                    {r.floor_plan_id === draft.id ? (
                      <span className="text-xs text-ok">{t('floorPlans.assigned')}</span>
                    ) : (
                      <Button onClick={() => assign(r.id)}>{t('floorPlans.assign')}</Button>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
