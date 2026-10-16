'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BarChart } from '@/components/BarChart';
import { FloorPlanView } from '@/components/FloorPlanView';
import { GridMapView } from '@/components/GridMapView';
import { HeatLayer, HeatLegend } from '@/components/MapLayers';
import { Empty, PageTitle, Panel, Segmented, Select, Stat } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { presetRange, RANGE_PRESETS, useFmt } from '@/lib/format';
import { useAsync, useCalibratedPlan } from '@/lib/hooks';

export default function CrowdPage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const [preset, setPreset] = useState<string>('today');
  const [metric, setMetric] = useState<'peak' | 'mean'>('peak');
  const [planId, setPlanId] = useState<number>();
  const bucket = preset === '30d' || preset === '7d' ? 'day' : 'hour';
  const heat = useAsync(() => api.crowd.heatmap(presetRange(preset)), [preset]);
  const timeline = useAsync(() => api.crowd.timeline(presetRange(preset), bucket), [preset]);
  // Without a calibrated plan the cells go on the grid in map coordinates.
  const { plan, calibrated, loaded } = useCalibratedPlan(planId);

  const cells = heat.data ?? [];
  const points = useMemo(() => timeline.data ?? [], [timeline.data]);
  const busiest = points.reduce<(typeof points)[number] | undefined>((a, b) => (!a || b.peak > a.peak ? b : a), undefined);
  const hourly = useMemo(() => {
    const byHour = new Array<number>(24).fill(0);
    points.forEach((p) => {
      const h = fmt.hourOfDay(p.bucket);
      byHour[h] = Math.max(byHour[h] ?? 0, p.peak);
    });
    return byHour.map((v, h) => ({ label: String(h).padStart(2, '0'), value: v }));
  }, [points, fmt]);
  const unit = t('crowd.people');

  return (
    <>
      <PageTitle
        title={t('crowd.title')}
        subtitle={t('crowd.subtitle')}
        actions={
          <>
            <Segmented value={preset} onChange={setPreset} options={RANGE_PRESETS.map((p) => ({ value: p.key, label: t(p.label) }))} />
            <Segmented<'peak' | 'mean'>
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'peak', label: t('crowd.peak') },
                { value: 'mean', label: t('crowd.mean') },
              ]}
            />
            {calibrated.length > 1 && (
              <Select value={plan?.id ?? ''} onChange={(e) => setPlanId(Number(e.target.value))} className="w-44">
                {calibrated.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t('crowd.peak')}
          value={busiest?.peak ?? 0}
          hint={busiest ? `${fmt.day(busiest.bucket)} ${bucket === 'hour' ? fmt.time(busiest.bucket) : ''}` : '—'}
          tone="warn"
        />
        <Stat label={t('crowd.areaCovered')} value={`${cells.length} m²`} hint={t('crowd.cells')} />
        <Stat label={t('crowd.busiestCell')} value={Math.max(0, ...cells.map((c) => c.peak))} hint={t('crowd.inOneCell')} />
        <Stat label={t('crowd.samples')} value={cells.reduce((a, c) => a + c.samples, 0)} hint={t('crowd.minuteWindows')} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-2">
          {plan ? (
            <FloorPlanView plan={plan} className="h-[60vh]">
              <HeatLayer plan={plan} cells={cells} metric={metric} unit={unit} />
            </FloorPlanView>
          ) : loaded ? (
            <>
              <GridMapView className="h-[60vh]" robots={[]} routes={[]} anomalies={[]} heat={{ cells, metric, unit }} />
              <p className="text-xs text-slate-500">
                {t('crowd.gridNoPlan')}{' '}
                <Link href="/floor-plans" className="text-accent underline">
                  {t('map.uploadPlan')}
                </Link>
              </p>
            </>
          ) : (
            <div className="h-[60vh] rounded-xl border border-ink-600 bg-ink-950" />
          )}
          <HeatLegend max={Math.max(1, ...cells.map((c) => c[metric]))} unit={unit} />
        </div>
        <div className="space-y-4">
          <Panel title={bucket === 'hour' ? t('crowd.perHour') : t('crowd.perDay')}>
            {points.length ? (
              <BarChart
                data={points.map((p) => ({ label: bucket === 'hour' ? fmt.time(p.bucket) : fmt.day(p.bucket), value: p.peak }))}
                unit={` ${unit}`}
              />
            ) : (
              <Empty>{t('crowd.noData')}</Empty>
            )}
          </Panel>
          {bucket === 'hour' && (
            <Panel title={t('crowd.busiestHours')}>
              <BarChart data={hourly} unit={` ${unit}`} height={140} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
