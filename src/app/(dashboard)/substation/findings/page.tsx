'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PriorityChip } from '@/components/substation/Priority';
import { Value } from '@/components/substation/Value';
import { Badge, Empty, ErrorNote, Input, PageTitle, Panel, Segmented, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { useMe } from '@/lib/session';
import { PRIORITIES, PRIORITY_SOFT, findingValue } from '@/lib/substation';
import type { FindingStatus } from '@/lib/types';
import { FindingRow, useBasisText } from '../_components/FindingRow';
import { FindingThumb } from '../_components/FindingThumb';
import { useSubstationRevision } from '../_lib/live';
import { useQuery } from '../_lib/query';
import { STATUS_TONE } from '../_lib/status';

type StatusFilter = FindingStatus | 'active' | 'all';

/** Every finding, the most severe first: filter by status and priority, search by equipment. */
export default function FindingsPage() {
  const { t, tx, locale } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { has } = useMe();
  const rev = useSubstationRevision();
  const query = useQuery();
  const [status, setStatus] = useState<StatusFilter>('active');
  const [priorities, setPriorities] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const basis = useBasisText();

  useEffect(() => {
    if (!query) return;
    const st = query.get('status');
    if (st && ['open', 'acknowledged', 'resolved', 'active', 'all'].includes(st)) setStatus(st as StatusFilter);
    const p = Number(query.get('priority'));
    if (p >= 1 && p <= 4) setPriorities(new Set([p]));
  }, [query]);

  const list = useAsync(() => api.substation.findings({ status: status === 'all' ? undefined : status, limit: 1000 }), [status, rev]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? []).filter(
      (f) =>
        (priorities.size === 0 || priorities.has(f.priority)) &&
        (!q || [f.asset_tag, f.asset_name, f.label, f.point_name].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [list.data, priorities, search]);

  const toggle = (p: number) =>
    setPriorities((cur) => {
      const next = new Set(cur);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  return (
    <>
      <PageTitle
        title={t('substation.findings.title')}
        subtitle={t('substation.findings.subtitle')}
        actions={
          has('reports.export') && (
            <a
              href={api.substation.findingsExport(status === 'all' ? undefined : status, locale)}
              className="rounded border border-ink-500 px-3 py-1.5 text-sm text-slate-200 hover:border-accent hover:text-accent"
            >
              {t('patrols.exportXlsx')}
            </a>
          )
        }
      />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            options={(['active', 'open', 'acknowledged', 'resolved', 'all'] as StatusFilter[]).map((v) => ({
              value: v,
              label: tx('substation.findings.filter', v),
            }))}
          />
          <div className="flex gap-1.5" role="group" aria-label={t('substation.priorityLabel')}>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={priorities.has(p)}
                onClick={() => toggle(p)}
                className={cx(
                  'rounded px-2 py-1 text-xs font-semibold ring-1 transition',
                  priorities.has(p) ? PRIORITY_SOFT[p] : 'text-slate-400 ring-ink-500 hover:text-slate-200',
                )}
              >
                P{p}
              </button>
            ))}
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('substation.findings.search')}
            className="ml-auto max-w-xs"
            aria-label={t('substation.findings.search')}
          />
        </div>
        <ErrorNote error={list.error} />
        {list.data && !shown.length ? (
          <Empty>
            {status === 'active' && !search && !priorities.size ? t('substation.findings.noneActive') : t('substation.findings.none')}
          </Empty>
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {shown.map((f) => (
                <FindingRow key={f.id} finding={f} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table>
                <thead>
                  <tr>
                    <th className="w-20">{t('substation.priorityLabel')}</th>
                    <th>{t('substation.findings.equipment')}</th>
                    <th className="text-right">{t('substation.findings.reading')}</th>
                    <th>{t('substation.findings.since')}</th>
                    <th>{t('substation.findings.lastSeen')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => router.push(`/substation/findings/${f.id}`)}
                      className={cx('cursor-pointer transition hover:bg-ink-800/60', f.status === 'resolved' && 'opacity-60')}
                    >
                      <td>
                        <PriorityChip p={f.priority} />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <FindingThumb finding={f} className="h-9 w-12" />
                          <div className="min-w-0">
                            <Link
                              href={`/substation/findings/${f.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate font-medium text-slate-100 hover:text-accent"
                            >
                              {f.asset_tag && <span className="font-mono text-slate-300">{f.asset_tag} </span>}
                              {f.label}
                            </Link>
                            <div className="truncate text-xs text-slate-500">{f.point_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right">
                        <Value text={findingValue(f)} className="block font-semibold text-slate-100" />
                        <div className="text-[11px] text-slate-500">{basis(f)}</div>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-400">
                        {fmt.dateTime(f.first_seen)}
                        <div className="text-slate-500">{t('substation.findings.seenTimes', { n: f.occurrences })}</div>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-400">
                        {fmt.ago(f.last_seen)}
                        {f.last_priority !== f.priority && (
                          <div className="mt-0.5">
                            <span className="text-slate-500">{t('substation.findings.latest')} </span>
                            <PriorityChip p={f.last_priority} />
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[f.status]}>{tx('substation.status', f.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
