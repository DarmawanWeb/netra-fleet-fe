'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { FloorPlanView } from '@/components/FloorPlanView';
import { RobotMarker } from '@/components/MapLayers';
import { Button, Empty, PageTitle, Panel, Segmented } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { presetRange, RANGE_PRESETS, useFmt } from '@/lib/format';
import { mapToPlan } from '@/lib/geometry';
import { useAsync } from '@/lib/hooks';
import type { TrackPoint } from '@/lib/types';

function LineChart({
  points,
  value,
  max,
  color,
}: {
  points: TrackPoint[];
  value: (p: TrackPoint) => number | null;
  max: number;
  color: string;
}) {
  const valid = points.filter((p) => value(p) !== null);
  if (valid.length < 2) return null;
  const t0 = new Date(valid[0]!.ts).getTime();
  const span = Math.max(1, new Date(valid[valid.length - 1]!.ts).getTime() - t0);
  const d = valid
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${(((new Date(p.ts).getTime() - t0) / span) * 1000).toFixed(1)},${(100 - (value(p)! / max) * 100).toFixed(1)}`,
    )
    .join('');
  return (
    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="h-28 w-full">
      <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function RobotDetailPage() {
  const id = useParams<{ id: string }>().id;
  const { t } = useI18n();
  const fmt = useFmt();
  const [preset, setPreset] = useState<string>('today');
  const track = useAsync(() => api.robots.track(id, presetRange(preset)), [id, preset]);
  const robots = useAsync(() => api.robots.list(), []);
  const plans = useAsync(() => api.floorPlans.list(), []);
  const robot = robots.data?.find((r) => r.id === id);
  const plan = plans.data?.find((p) => p.id === robot?.floor_plan_id) ?? plans.data?.[0];
  const points = useMemo(() => (track.data ?? []).filter((p) => p.x !== null && p.y !== null), [track.data]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<string>('4');

  useEffect(() => setCursor(Math.max(0, points.length - 1)), [points.length]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setCursor((c) => (c + 1 >= points.length ? (setPlaying(false), c) : c + 1)), 1000 / Number(speed));
    return () => clearInterval(timer);
  }, [playing, speed, points.length]);

  const current = points[cursor];
  const trail = plan ? points.slice(0, cursor + 1).map((p) => mapToPlan(plan, p.x!, p.y!)) : [];
  const s = plan ? Math.max(plan.px_per_m / 20, 0.6) : 1;

  return (
    <>
      <PageTitle
        title={robot?.name ?? id}
        subtitle={id}
        actions={
          <>
            <Segmented value={preset} onChange={setPreset} options={RANGE_PRESETS.map((p) => ({ value: p.key, label: t(p.label) }))} />
            <Link href="/map" className="text-sm text-accent">
              ← {t('common.back')}
            </Link>
          </>
        }
      />
      {!points.length ? (
        <Panel>
          <Empty>{t('robotDetail.noTrack')}</Empty>
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-2">
            {plan && (
              <FloorPlanView plan={plan} className="h-[60vh]">
                <polyline
                  points={trail.map((p) => `${p.px},${p.py}`).join(' ')}
                  fill="none"
                  stroke="#22d3ee"
                  strokeOpacity={0.7}
                  strokeWidth={2.5 * s}
                  strokeLinejoin="round"
                />
                {current && (
                  <RobotMarker plan={plan} pose={{ x: current.x!, y: current.y!, yaw: current.yaw ?? 0 }} name={robot?.name ?? id} />
                )}
              </FloorPlanView>
            )}
            <Panel title={t('robotDetail.track')}>
              <div className="flex items-center gap-3">
                <Button variant="primary" onClick={() => (cursor >= points.length - 1 && setCursor(0), setPlaying(!playing))}>
                  {playing ? t('robotDetail.pause') : t('robotDetail.play')}
                </Button>
                <input
                  type="range"
                  min={0}
                  max={points.length - 1}
                  value={cursor}
                  onChange={(e) => (setPlaying(false), setCursor(Number(e.target.value)))}
                  className="flex-1 accent-cyan-500"
                />
                <Segmented value={speed} onChange={setSpeed} options={['1', '4', '16'].map((v) => ({ value: v, label: `${v}×` }))} />
              </div>
              {current && (
                <div className="mt-2 text-xs text-slate-400">
                  {t('robotDetail.position', { time: fmt.dateTime(current.ts) })}: {current.x!.toFixed(1)}, {current.y!.toFixed(1)} m ·{' '}
                  {current.nav_state || '—'} · {current.battery ?? '—'}%
                </div>
              )}
            </Panel>
          </div>
          <div className="space-y-4">
            <Panel title={`${t('robotDetail.battery')} (%)`}>
              <LineChart points={track.data ?? []} value={(p) => p.battery} max={100} color="#22c55e" />
            </Panel>
            <Panel title={t('robotDetail.people')}>
              <LineChart
                points={track.data ?? []}
                value={(p) => p.people}
                max={Math.max(1, ...(track.data ?? []).map((p) => p.people))}
                color="#f59e0b"
              />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
