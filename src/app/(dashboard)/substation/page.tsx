'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { PriorityChip } from '@/components/substation/Priority';
import { ThermalView } from '@/components/substation/ThermalView';
import { Empty, ErrorNote, PageTitle, Panel } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { useMe } from '@/lib/session';
import { BayMatrix } from './_components/BayMatrix';
import { FindingRow } from './_components/FindingRow';
import { PriorityStrip } from './_components/PriorityStrip';
import { useSubstationRevision } from './_lib/live';

/** The substation at a glance: what needs attention, the equipment by bay, the latest captures. */
export default function SubstationOverview() {
  const { t } = useI18n();
  const fmt = useFmt();
  const { can } = useMe();
  const rev = useSubstationRevision();
  const summary = useAsync(() => api.substation.summary(), [rev]);
  const findings = useAsync(() => api.substation.findings({ status: 'active', limit: 8 }), [rev]);
  const assets = useAsync(() => api.substation.assets(), [rev]);
  const points = useAsync(() => api.substation.points(), []);
  const captures = useAsync(() => api.substation.inspections({ limit: 8 }), [rev]);
  const targetsOf = useMemo(() => new Map((points.data ?? []).map((p) => [p.id, p.targets])), [points.data]);
  const s = summary.data;

  return (
    <>
      <PageTitle
        title={t('substation.title')}
        subtitle={
          s
            ? `${s.last_inspection ? t('substation.overview.lastCapture', { ago: fmt.ago(s.last_inspection) }) : t('substation.overview.noCapture')} · ${t(
                'substation.overview.counts',
                { points: s.points, assets: s.assets, today: s.inspections_24h },
              )}`
            : t('substation.subtitle')
        }
        actions={
          <>
            <Link
              href="/substation/points"
              className="rounded border border-ink-500 px-3 py-1.5 text-sm text-slate-200 hover:border-accent hover:text-accent"
            >
              {t('nav.substationPoints')}
            </Link>
            <Link href="/substation/findings" className="rounded bg-accent/90 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-accent">
              {t('substation.overview.allFindings')}
            </Link>
          </>
        }
      />
      <ErrorNote error={summary.error} />
      {s && <PriorityStrip summary={s} />}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Panel title={t('substation.overview.bays')}>
          {assets.data?.length ? (
            <BayMatrix assets={assets.data} />
          ) : (
            <Empty>
              {t('substation.overview.noAssets')}{' '}
              {can('configure') && (
                <Link href="/substation/assets" className="text-accent hover:underline">
                  {t('substation.assets.add')}
                </Link>
              )}
            </Empty>
          )}
        </Panel>

        <Panel title={t('substation.overview.attention')}>
          {findings.data?.length ? (
            <div className="space-y-2">
              {findings.data.map((f) => (
                <FindingRow key={f.id} finding={f} />
              ))}
            </div>
          ) : (
            <Empty>{t('substation.overview.allClear')}</Empty>
          )}
        </Panel>
      </div>

      <Panel title={t('substation.overview.latest')} className="mt-4">
        {captures.data?.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
            {captures.data.map((c) => (
              <li key={c.id}>
                <Link href={`/substation/points/${c.point_id}?capture=${c.id}`} className="group block">
                  <ThermalView inspection={c} targets={targetsOf.get(c.point_id)} compact className="transition group-hover:opacity-90" />
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-slate-200">{c.point_name}</span>
                    <PriorityChip p={c.priority} />
                  </div>
                  <div className="text-[11px] text-slate-500">{fmt.dateTime(c.taken_at)}</div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t('substation.overview.noCaptures')}</Empty>
        )}
      </Panel>
    </>
  );
}
