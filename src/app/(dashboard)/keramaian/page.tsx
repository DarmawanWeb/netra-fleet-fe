'use client';

import { useMemo, useState } from 'react';
import { BarChart } from '@/components/BarChart';
import { FloorPlanView } from '@/components/FloorPlanView';
import { HeatLayer, HeatLegend } from '@/components/MapLayers';
import { Empty, PageTitle, Panel, Segmented, Select, Stat } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDay, fmtTime, RANGE_PRESETS } from '@/lib/format';
import { useAsync } from '@/lib/hooks';

export default function CrowdPage() {
  const [preset, setPreset] = useState('today');
  const [metric, setMetric] = useState<'peak' | 'mean'>('peak');
  const [planId, setPlanId] = useState<number>();
  const range = (RANGE_PRESETS.find((p) => p.key === preset) ?? RANGE_PRESETS[0]!).range;
  const bucket = preset === '30d' || preset === '7d' ? 'day' : 'hour';
  const heat = useAsync(() => api.crowd.heatmap(range()), [preset]);
  const timeline = useAsync(() => api.crowd.timeline(range(), bucket), [preset]);
  const plans = useAsync(() => api.floorPlans.list(), []);
  const plan = plans.data?.find((p) => p.id === planId) ?? plans.data?.[0];

  const cells = heat.data ?? [];
  const points = timeline.data ?? [];
  const busiest = points.reduce<(typeof points)[number] | undefined>((a, b) => (!a || b.peak > a.peak ? b : a), undefined);
  const hourly = useMemo(() => {
    // Busiest hours of the day across the range (peak per hour-of-day).
    const byHour = new Array<number>(24).fill(0);
    points.forEach((p) => {
      const h = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date(p.bucket)));
      byHour[h % 24] = Math.max(byHour[h % 24] ?? 0, p.peak);
    });
    return byHour.map((v, h) => ({ label: `${String(h).padStart(2, '0')}`, value: v }));
  }, [points]);

  return (
    <>
      <PageTitle
        title="Keramaian"
        subtitle="Heatmap orang terdeteksi robot selama patroli"
        actions={
          <>
            <Segmented value={preset} onChange={setPreset} options={RANGE_PRESETS.map((p) => ({ value: p.key, label: p.label }))} />
            <Segmented<'peak' | 'mean'> value={metric} onChange={setMetric} options={[{ value: 'peak', label: 'Puncak' }, { value: 'mean', label: 'Rata-rata' }]} />
            {(plans.data?.length ?? 0) > 1 && (
              <Select value={plan?.id ?? ''} onChange={(e) => setPlanId(Number(e.target.value))} className="w-44">
                {plans.data?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Puncak" value={busiest?.peak ?? 0} hint={busiest ? `${fmtDay(busiest.bucket)} ${bucket === 'hour' ? fmtTime(busiest.bucket) : ''}` : '—'} tone="warn" />
        <Stat label="Area terpantau" value={`${cells.length} m²`} hint="sel 1×1 m" />
        <Stat label="Sel terpadat" value={Math.max(0, ...cells.map((c) => c.peak))} hint="orang dalam 1 sel" />
        <Stat label="Sampel" value={cells.reduce((a, c) => a + c.samples, 0)} hint="jendela 1 menit" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-2">
          {plan ? (
            <FloorPlanView plan={plan} className="h-[60vh]">
              <HeatLayer plan={plan} cells={cells} metric={metric} />
            </FloorPlanView>
          ) : (
            <Panel><Empty>Unggah denah terlebih dahulu.</Empty></Panel>
          )}
          <HeatLegend max={Math.max(1, ...cells.map((c) => c[metric]))} />
        </div>
        <div className="space-y-4">
          <Panel title={bucket === 'hour' ? 'Puncak per jam' : 'Puncak per hari'}>
            {points.length ? (
              <BarChart data={points.map((p) => ({ label: bucket === 'hour' ? fmtTime(p.bucket) : fmtDay(p.bucket), value: p.peak }))} unit=" orang" />
            ) : (
              <Empty>Belum ada data.</Empty>
            )}
          </Panel>
          {bucket === 'hour' && (
            <Panel title="Jam tersibuk">
              <BarChart data={hourly} unit=" orang" height={140} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
