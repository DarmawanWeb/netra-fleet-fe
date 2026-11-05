'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { PriorityChip } from '@/components/substation/Priority';
import { Value } from '@/components/substation/Value';
import { ThermalView } from '@/components/substation/ThermalView';
import { TrendChart } from '@/components/substation/TrendChart';
import { Badge, Button, ErrorNote, PageTitle, Panel, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { useRouteParam } from '@/lib/route';
import { useMe } from '@/lib/session';
import { PRIORITY_SOFT, PRIORITY_TEXT, celsius, findingValue, priorityColor, signed } from '@/lib/substation';
import type { Finding, Inspection } from '@/lib/types';
import { useSubstationRevision } from '../../_lib/live';
import { STATUS_TONE } from '../../_lib/status';

const DAY = 86_400_000;

/** One finding: the capture that rated it, why, its course over time, and the follow-up. */
export default function FindingDetail() {
  const id = Number(useRouteParam());
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const rev = useSubstationRevision();
  const finding = useAsync(() => api.substation.finding(id), [id, rev]);
  const f = finding.data;
  const point = useAsync(() => (f ? api.substation.point(f.point_id) : Promise.resolve(undefined)), [f?.point_id]);
  const capture = useAsync(
    () => (f ? api.substation.inspection(f.last_inspection_id) : Promise.resolve(undefined)),
    [f?.last_inspection_id],
  );
  const trend = useAsync(
    () => (f ? api.substation.trend(f.point_id, { from: new Date(Date.now() - 30 * DAY), to: new Date() }) : Promise.resolve(undefined)),
    [f?.point_id, rev],
  );
  const criteria = useAsync(() => api.substation.criteria(), []);

  if (!f) return <ErrorNote error={finding.error} />;
  const title = `${f.asset_tag ? `${f.asset_tag} · ` : ''}${f.label}`;

  return (
    <>
      <div className="mb-2">
        <Link href="/substation/findings" className="text-sm text-accent hover:underline">
          ← {t('substation.findings.title')}
        </Link>
      </div>
      <PageTitle
        title={title}
        subtitle={`${f.point_name} · ${tx('substation.action', String(f.priority))}`}
        actions={
          <>
            <PriorityChip p={f.priority} named className="text-xs" />
            <Badge tone={STATUS_TONE[f.status]}>{tx('substation.status', f.status)}</Badge>
          </>
        }
      />

      {/* On a phone the panels read in the order that matters: the image, the reading, the follow-up, then the rest. */}
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="contents xl:block xl:space-y-4">
          <Panel
            className="order-1"
            title={t('substation.findings.latestCapture')}
            actions={capture.data && <span className="text-xs text-slate-400">{fmt.dateTime(capture.data.taken_at)}</span>}
          >
            <ThermalView inspection={capture.data} targets={point.data?.targets} highlight={f.target_key} />
          </Panel>
          <Panel className="order-4" title={t('substation.trendTitle')}>
            {trend.data ? (
              <TrendChart trend={trend.data} highlight={f.target_key} highlightColor={priorityColor(f.priority)} />
            ) : (
              <ErrorNote error={trend.error} />
            )}
          </Panel>
        </div>

        <div className="contents xl:block xl:space-y-4">
          <div className="order-2">
            <Reading finding={f} capture={capture.data} criteria={criteria.data?.thermal} />
          </div>
          <div className="order-3">
            <FollowUp finding={f} onChange={finding.reload} />
          </div>
          <Panel className="order-5" title={t('substation.findings.history')}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Fact k={t('substation.findings.since')} v={fmt.dateTime(f.first_seen)} />
              <Fact k={t('substation.findings.lastSeen')} v={`${fmt.dateTime(f.last_seen)} (${fmt.ago(f.last_seen)})`} />
              <Fact k={t('substation.findings.occurrences')} v={t('substation.findings.seenTimes', { n: f.occurrences })} />
              <Fact k={t('substation.findings.latestRating')} v={<PriorityChip p={f.last_priority} />} />
              <Fact k="Telegram" v={f.notified_at ? fmt.dateTime(f.notified_at) : t('anomalies.notSent')} />
              {f.acknowledged_by && (
                <Fact k={t('substation.findings.acknowledgedBy')} v={`${f.acknowledged_by}, ${fmt.dateTime(f.acknowledged_at)}`} />
              )}
              {f.resolved_by && <Fact k={t('substation.findings.resolvedBy')} v={`${f.resolved_by}, ${fmt.dateTime(f.resolved_at)}`} />}
              <Fact
                k={t('substation.findings.equipment')}
                v={
                  f.asset_id ? (
                    <Link href={`/substation/assets/${f.asset_id}`} className="text-accent hover:underline">
                      {f.asset_tag} · {f.asset_name}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <Fact
                k={t('substation.points.point')}
                v={
                  <Link href={`/substation/points/${f.point_id}`} className="text-accent hover:underline">
                    {f.point_name}
                  </Link>
                }
              />
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Fact({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-slate-400">{k}</dt>
      <dd className="min-w-0 text-slate-200">{v}</dd>
    </div>
  );
}

/** The reading that rated the finding and where it falls in the NETA table. */
function Reading({
  finding: f,
  capture,
  criteria,
}: {
  finding: Finding;
  capture?: Inspection;
  criteria?: { priority: number; similar: string; ambient: string }[];
}) {
  const { t, tx } = useI18n();
  const result = capture?.thermal?.find((r) => r.key === f.target_key);
  const refLabel = result?.ref_key ? (capture?.thermal?.find((r) => r.key === result.ref_key)?.label ?? result.ref_key) : undefined;
  const column = f.basis === 'ambient' ? 'ambient' : 'similar';
  let why = '';
  if (f.kind === 'pd') why = t('substation.findings.whyPd');
  else if (f.basis === 'limit') why = t('substation.findings.whyLimit');
  else if (f.basis === 'ambient')
    why = t('substation.findings.whyAmbient', { delta: signed(f.last_delta_c), ambient: celsius(capture?.ambient_c) });
  else if (f.last_delta_c !== null) why = t('substation.findings.whySimilar', { delta: signed(f.last_delta_c), ref: refLabel ?? '—' });
  return (
    <section className="rounded-lg border border-ink-600 bg-ink-900/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Value text={findingValue(f)} className={cx('block text-4xl font-semibold', PRIORITY_TEXT[f.priority])} />
          <p className="mt-1 text-sm text-slate-300">{why}</p>
          {f.last_priority !== f.priority && (
            <p className="mt-1 text-xs text-slate-500">
              {t('substation.findings.worstHint', {
                p: `P${f.priority}`,
                latest: f.last_priority ? `P${f.last_priority}` : t('substation.normal'),
              })}
            </p>
          )}
        </div>
      </div>
      {f.kind === 'thermal' && criteria && f.basis !== 'limit' && (
        <table className="mt-4 text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1.5">{t('substation.priorityLabel')}</th>
              <th className="px-2 py-1.5">{tx('substation.netaColumn', column)}</th>
              <th className="px-2 py-1.5">{t('substation.findings.action')}</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const here = c.priority === f.priority;
              const range = column === 'ambient' ? c.ambient : c.similar;
              return (
                <tr key={c.priority} className={cx(here && PRIORITY_SOFT[f.priority], here && 'ring-1')}>
                  <td className="px-2 py-1.5 font-semibold">P{c.priority}</td>
                  <td className={cx('px-2 py-1.5 font-mono tabular-nums', !range && 'text-slate-600')}>{range || '—'}</td>
                  <td className="px-2 py-1.5">{tx('substation.action', String(c.priority))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {f.kind === 'thermal' && <p className="mt-2 text-[11px] text-slate-500">{t('substation.netaSource')}</p>}
    </section>
  );
}

/** Acknowledge (taken in hand, e.g. with a work order) and resolve, with a note. */
function FollowUp({ finding: f, onChange }: { finding: Finding; onChange: () => void }) {
  const { t } = useI18n();
  const { can } = useMe();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!can('operate') || f.status === 'resolved') {
    return f.note ? (
      <Panel title={t('substation.findings.note')}>
        <p className="whitespace-pre-wrap text-sm text-slate-200">{f.note}</p>
      </Panel>
    ) : null;
  }
  const act = async (resolve: boolean) => {
    if (resolve && !window.confirm(t('substation.findings.confirmResolve'))) return;
    setBusy(true);
    setError(undefined);
    try {
      await (resolve ? api.substation.resolve(f.id, note.trim() || undefined) : api.substation.acknowledge(f.id, note.trim() || undefined));
      setNote('');
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title={t('substation.findings.followUp')}>
      {f.note && <p className="mb-3 whitespace-pre-wrap rounded bg-ink-800/70 px-3 py-2 text-sm text-slate-200">{f.note}</p>}
      <label className="block space-y-1">
        <span className="text-xs text-slate-400">{t('substation.findings.noteLabel')}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={t('substation.findings.notePlaceholder')}
          className="w-full rounded border border-ink-500 bg-ink-950 px-2.5 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {f.status === 'open' && (
          <Button variant="primary" disabled={busy} onClick={() => act(false)}>
            {t('substation.findings.acknowledge')}
          </Button>
        )}
        <Button variant="ok" disabled={busy} onClick={() => act(true)}>
          {t('substation.findings.resolve')}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{t('substation.findings.followUpHelp')}</p>
      <ErrorNote error={error} />
    </Panel>
  );
}
