'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Empty, ErrorNote, PageTitle, Panel, Segmented, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, fmtPct, RANGE_PRESETS } from '@/lib/format';
import { useAsync, useRules } from '@/lib/hooks';
import { ANOMALY_STATUS } from '@/lib/labels';
import { useLive } from '@/lib/live';

type Tab = 'needs_validation' | 'confirmed' | 'rejected' | 'all';

export default function AnomaliesPage() {
  const { revision } = useLive();
  const rules = useRules();
  const [tab, setTab] = useState<Tab>('needs_validation');
  const [category, setCategory] = useState('');
  const [preset, setPreset] = useState('7d');
  const range = (RANGE_PRESETS.find((p) => p.key === preset) ?? RANGE_PRESETS[2]!).range;
  const list = useAsync(
    () => api.anomalies.list({ status: tab === 'all' ? undefined : tab, category: category || undefined }, range()),
    [tab, category, preset, revision],
  );

  return (
    <>
      <PageTitle
        title="Anomali"
        subtitle="Deteksi awal di robot, deteksi final di server, validasi oleh operator"
        actions={
          <>
            <Segmented value={preset} onChange={setPreset} options={RANGE_PRESETS.map((p) => ({ value: p.key, label: p.label }))} />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">
              <option value="">Semua kategori</option>
              {rules.data?.map((r) => (
                <option key={r.category} value={r.category}>{r.label}</option>
              ))}
            </Select>
          </>
        }
      />
      <div className="mb-4">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'needs_validation', label: 'Perlu validasi' },
            { value: 'confirmed', label: 'Terkonfirmasi' },
            { value: 'rejected', label: 'Ditolak' },
            { value: 'all', label: 'Semua' },
          ]}
        />
      </div>
      <ErrorNote error={list.error} />
      {list.data && !list.data.length ? (
        <Panel>
          <Empty>Tidak ada anomali.</Empty>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.data?.map((a) => {
            const status = ANOMALY_STATUS[a.status];
            return (
              <Link key={a.id} href={`/anomali/${a.id}`} className="group overflow-hidden rounded-lg border border-ink-600 bg-ink-900 hover:border-accent">
                <div className="aspect-video overflow-hidden bg-ink-950">
                  <img src={api.anomalies.imageUrl(a.id)} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                </div>
                <div className="space-y-1.5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{rules.label(a.final_category ?? a.early_category)}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmtDateTime(a.detected_at)} · {a.robot_id}
                  </div>
                  <div className="text-xs text-slate-500">
                    Awal {rules.label(a.early_category)} {fmtPct(a.early_confidence)}
                    {a.final_confidence !== null && ` · Final ${fmtPct(a.final_confidence)}`}
                    {a.notified_at && ' · Telegram ✓'}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
