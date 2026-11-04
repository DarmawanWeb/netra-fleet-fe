'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PriorityChip } from '@/components/substation/Priority';
import { ThermalView } from '@/components/substation/ThermalView';
import { Badge, Button, Empty, ErrorNote, PageTitle, Panel } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { useRouteParam } from '@/lib/route';
import { useMe } from '@/lib/session';
import type { InspectionPoint } from '@/lib/types';
import { AssetForm } from '../../_components/AssetForm';
import { condition } from '../../_components/BayMatrix';
import { FindingRow } from '../../_components/FindingRow';
import { useSubstationRevision } from '../../_lib/live';

/** One piece of equipment: its condition, findings, and the points that measure it with their latest capture. */
export default function AssetDetail() {
  const id = Number(useRouteParam());
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const { can } = useMe();
  const rev = useSubstationRevision();
  const [editing, setEditing] = useState(false);
  const asset = useAsync(() => api.substation.asset(id), [id, rev]);
  const findings = useAsync(() => api.substation.findings({ assetId: id, limit: 50 }), [id, rev]);
  const points = useAsync(() => api.substation.points(), [rev]);
  const all = useAsync(() => api.substation.assets(true), []);
  const a = asset.data;
  const measuring = (points.data ?? []).filter((p) => p.asset_id === id || p.targets.some((tg) => tg.asset_id === id));

  if (!a) return <ErrorNote error={asset.error} />;
  const c = condition(a);
  const facts: [string, string][] = [
    [t('substation.assets.kind'), tx('substation.kinds', a.kind)],
    [t('substation.assets.bay'), a.bay || '—'],
    ['kV', a.voltage_kv?.toString() ?? '—'],
    [t('substation.assets.phase'), a.phase || '—'],
    [t('substation.assets.position'), a.x !== null && a.y !== null ? `${a.x.toFixed(1)}, ${a.y.toFixed(1)} m` : '—'],
    [t('substation.assets.lastInspected'), a.last_inspected ? fmt.dateTime(a.last_inspected) : t('substation.notInspected')],
  ];
  const active = (findings.data ?? []).filter((f) => f.status !== 'resolved');
  const resolved = (findings.data ?? []).filter((f) => f.status === 'resolved');

  return (
    <>
      <div className="mb-2">
        <Link href="/substation/assets" className="text-sm text-accent hover:underline">
          ← {t('substation.assets.title')}
        </Link>
      </div>
      <PageTitle
        title={`${a.tag} · ${a.name}`}
        subtitle={[tx('substation.kinds', a.kind), a.bay, a.voltage_kv ? `${a.voltage_kv} kV` : ''].filter(Boolean).join(' · ')}
        actions={
          <>
            {c === null ? <Badge>{t('substation.notInspected')}</Badge> : <PriorityChip p={c} named className="text-xs" />}
            {a.archived && <Badge>{t('substation.assets.archived')}</Badge>}
            {can('configure') && <Button onClick={() => setEditing(true)}>{t('common.edit')}</Button>}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <Panel title={t('substation.assets.details')}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
            {a.notes && <p className="mt-3 whitespace-pre-wrap border-t border-ink-600 pt-3 text-sm text-slate-300">{a.notes}</p>}
          </Panel>
          <Panel title={t('substation.findings.title')}>
            {active.length || resolved.length ? (
              <div className="space-y-2">
                {active.map((f) => (
                  <FindingRow key={f.id} finding={f} />
                ))}
                {resolved.length > 0 && (
                  <details className="pt-1">
                    <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                      {t('substation.assets.resolvedCount', { n: resolved.length })}
                    </summary>
                    <div className="mt-2 space-y-2 opacity-70">
                      {resolved.map((f) => (
                        <FindingRow key={f.id} finding={f} />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <Empty>{t('substation.assets.noFindings')}</Empty>
            )}
          </Panel>
        </div>
        <Panel title={t('substation.assets.measuredBy')}>
          {measuring.length ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {measuring.map((p) => (
                <PointCapture key={p.id} point={p} rev={rev} />
              ))}
            </ul>
          ) : (
            <Empty>{t('substation.assets.noPoints')}</Empty>
          )}
        </Panel>
      </div>
      <AssetForm
        open={editing}
        asset={a}
        bays={[...new Set((all.data ?? []).map((x) => x.bay))]}
        onClose={() => setEditing(false)}
        onSaved={(saved) => (saved ? asset.reload() : (window.location.href = '/substation/assets'))}
      />
    </>
  );
}

/** A point's latest capture as a card. */
function PointCapture({ point, rev }: { point: InspectionPoint; rev: number }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const latest = useAsync(() => api.substation.inspections({ pointId: point.id, limit: 1 }), [point.id, rev]);
  const capture = latest.data?.[0];
  return (
    <li>
      <Link href={`/substation/points/${point.id}`} className="group block">
        <ThermalView inspection={capture} targets={point.targets} compact className="transition group-hover:opacity-90" />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-slate-100">{point.name}</span>
          {capture && <PriorityChip p={capture.priority} />}
        </div>
        <div className="text-[11px] text-slate-500">{capture ? fmt.dateTime(capture.taken_at) : t('substation.notInspected')}</div>
      </Link>
    </li>
  );
}
