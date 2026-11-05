'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useMemo, useState } from 'react';
import { PriorityChip, PriorityDot } from '@/components/substation/Priority';
import { Button, Empty, ErrorNote, Input, PageTitle, Panel, Toggle, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { useMe } from '@/lib/session';
import type { Asset } from '@/lib/types';
import { AssetForm } from '../_components/AssetForm';
import { condition } from '../_components/BayMatrix';
import { useSubstationRevision } from '../_lib/live';

/** The site's equipment by bay with its condition; administrators add and change it. */
export default function AssetsPage() {
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { can } = useMe();
  const rev = useSubstationRevision();
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Asset | 'new' | null>(null);
  const assets = useAsync(() => api.substation.assets(archived), [archived, rev]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (assets.data ?? []).filter((a) => !q || [a.tag, a.name, a.bay, a.kind].some((v) => v.toLowerCase().includes(q)));
    const bays = new Map<string, Asset[]>();
    for (const a of list) bays.set(a.bay, [...(bays.get(a.bay) ?? []), a]);
    return [...bays.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, undefined, { numeric: true })));
  }, [assets.data, search]);
  const bays = useMemo(() => [...new Set((assets.data ?? []).map((a) => a.bay))], [assets.data]);

  return (
    <>
      <PageTitle
        title={t('substation.assets.title')}
        subtitle={t('substation.assets.subtitle')}
        actions={
          can('configure') && (
            <Button variant="primary" onClick={() => setEditing('new')}>
              {t('substation.assets.add')}
            </Button>
          )
        }
      />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('substation.assets.search')}
            className="max-w-xs"
            aria-label={t('substation.assets.search')}
          />
          <Toggle checked={archived} onChange={setArchived} label={t('substation.assets.showArchived')} />
        </div>
        <ErrorNote error={assets.error} />
        {assets.data && !groups.length ? (
          <Empty>{search ? t('substation.assets.noMatch') : t('substation.overview.noAssets')}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th className="w-36">{t('substation.condition')}</th>
                  <th>{t('substation.assets.tag')}</th>
                  <th>{t('common.name')}</th>
                  <th>{t('substation.assets.kind')}</th>
                  <th className="text-right">kV</th>
                  <th>{t('substation.assets.phase')}</th>
                  <th className="text-right">{t('substation.assets.openFindings')}</th>
                  <th>{t('substation.assets.lastInspected')}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([bay, list]) => (
                  <Fragment key={bay || '-'}>
                    <tr>
                      <td colSpan={8} className="border-b-ink-600 bg-ink-800/50 py-1.5 text-xs font-semibold text-slate-300">
                        {bay || t('substation.assets.noBay')}
                        <span className="ml-2 font-normal text-slate-500">
                          {list.length === 1
                            ? t('substation.overview.assetCountOne')
                            : t('substation.overview.assetCount', { n: list.length })}
                        </span>
                      </td>
                    </tr>
                    {list.map((a) => {
                      const c = condition(a);
                      return (
                        <tr
                          key={a.id}
                          onClick={() => router.push(`/substation/assets/${a.id}`)}
                          className={cx('cursor-pointer transition hover:bg-ink-800/60', a.archived && 'opacity-50')}
                        >
                          <td>
                            {c === null ? (
                              <span className="whitespace-nowrap text-xs text-slate-500">{t('substation.notInspected')}</span>
                            ) : (
                              <PriorityChip p={c} />
                            )}
                          </td>
                          <td>
                            <Link
                              href={`/substation/assets/${a.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono font-semibold text-slate-100 hover:text-accent"
                            >
                              {a.tag}
                            </Link>
                          </td>
                          <td className="text-slate-200">{a.name}</td>
                          <td className="text-slate-400">{tx('substation.kinds', a.kind)}</td>
                          <td className="text-right font-mono tabular-nums text-slate-300">{a.voltage_kv ?? '—'}</td>
                          <td className="text-slate-300">{a.phase || '—'}</td>
                          <td className="text-right font-mono tabular-nums">
                            {a.open_findings ? (
                              <span className="inline-flex items-center gap-1.5 text-slate-100">
                                <PriorityDot p={a.priority} className="h-2 w-2" />
                                {a.open_findings}
                              </span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap text-xs text-slate-400">{a.last_inspected ? fmt.ago(a.last_inspected) : '—'}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <AssetForm
        open={editing !== null}
        asset={editing === 'new' || editing === null ? undefined : editing}
        bays={bays}
        onClose={() => setEditing(null)}
        onSaved={() => assets.reload()}
      />
    </>
  );
}
