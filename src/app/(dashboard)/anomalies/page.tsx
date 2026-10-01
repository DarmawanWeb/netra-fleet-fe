'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Empty, ErrorNote, PageTitle, Panel, Segmented, Select } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { presetRange, RANGE_PRESETS, useFmt } from '@/lib/format';
import { useAsync, useRules } from '@/lib/hooks';
import { ANOMALY_TONE } from '@/lib/labels';
import { useLive } from '@/lib/live';

type Tab = 'needs_validation' | 'confirmed' | 'rejected' | 'all';

export default function AnomaliesPage() {
  const { t, tx, locale } = useI18n();
  const fmt = useFmt();
  const { revision } = useLive();
  const rules = useRules();
  const [tab, setTab] = useState<Tab>('needs_validation');
  const [category, setCategory] = useState('');
  const [preset, setPreset] = useState<string>('7d');
  const list = useAsync(
    () => api.anomalies.list({ status: tab === 'all' ? undefined : tab, category: category || undefined }, presetRange(preset)),
    [tab, category, preset, revision],
  );

  return (
    <>
      <PageTitle
        title={t('anomalies.title')}
        subtitle={t('anomalies.subtitle')}
        actions={
          <>
            <Segmented value={preset} onChange={setPreset} options={RANGE_PRESETS.map((p) => ({ value: p.key, label: t(p.label) }))} />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">
              <option value="">{t('anomalies.allCategories')}</option>
              {rules.data?.map((r) => (
                <option key={r.category} value={r.category}>
                  {rules.label(r.category)}
                </option>
              ))}
            </Select>
            <a
              className="rounded border border-ink-500 px-3 py-1.5 text-sm text-slate-200 hover:border-accent hover:text-accent"
              href={api.reports.anomalies(presetRange(preset), locale)}
            >
              {t('anomalies.exportXlsx')}
            </a>
          </>
        }
      />
      <div className="mb-4">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'needs_validation', label: t('anomalyStatus.needs_validation') },
            { value: 'confirmed', label: t('anomalyStatus.confirmed') },
            { value: 'rejected', label: t('anomalyStatus.rejected') },
            { value: 'all', label: t('common.all') },
          ]}
        />
      </div>
      <ErrorNote error={list.error} />
      {list.data && !list.data.length ? (
        <Panel>
          <Empty>{t('anomalies.empty')}</Empty>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.data?.map((a) => (
            <Link
              key={a.id}
              href={`/anomalies/${a.id}`}
              className="group overflow-hidden rounded-lg border border-ink-600 bg-ink-900 hover:border-accent"
            >
              <div className="aspect-video overflow-hidden bg-ink-950">
                <img
                  src={api.anomalies.imageUrl(a.id)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="space-y-1.5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-100">{rules.label(a.final_category ?? a.early_category)}</span>
                  <Badge tone={ANOMALY_TONE[a.status]}>{tx('anomalyStatus', a.status)}</Badge>
                </div>
                <div className="text-xs text-slate-400">
                  {fmt.dateTime(a.detected_at)} · {a.robot_id}
                </div>
                <div className="text-xs text-slate-500">
                  {t('anomalies.early')} {rules.label(a.early_category)} {fmt.pct(a.early_confidence)}
                  {a.final_confidence !== null && ` · ${t('anomalies.final')} ${fmt.pct(a.final_confidence)}`}
                  {a.notified_at && ` · ${t('anomalies.telegramSent')}`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
