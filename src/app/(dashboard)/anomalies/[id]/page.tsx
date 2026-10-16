'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { FloorPlanView } from '@/components/FloorPlanView';
import { GridMapView } from '@/components/GridMapView';
import { AnomalyPin, RouteLayer } from '@/components/MapLayers';
import { Badge, Button, ErrorNote, Field, Input, PageTitle, Panel, Select } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync, useCalibratedPlan, useRules } from '@/lib/hooks';
import { ANOMALY_TONE } from '@/lib/labels';
import { useMe } from '@/lib/session';

export default function AnomalyDetailPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const { can } = useMe();
  const rules = useRules();
  const anomaly = useAsync(() => api.anomalies.get(id), [id]);
  const robots = useAsync(() => api.robots.list(), []);
  const a = anomaly.data;
  const route = useAsync(() => (a?.route_id ? api.routes.get(a.route_id) : Promise.resolve(undefined)), [a?.route_id]);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const { plan, loaded } = useCalibratedPlan(robots.data?.find((r) => r.id === a?.robot_id)?.floor_plan_id);

  const decide = async (decision: 'confirm' | 'reject') => {
    setBusy(true);
    setError(undefined);
    try {
      await api.anomalies.validate(id, decision, category || undefined, note || undefined);
      anomaly.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!a) return <ErrorNote error={anomaly.error} />;
  const facts: [string, React.ReactNode][] = [
    [t('anomalies.earlyRobot'), `${rules.label(a.early_category)} · ${fmt.pct(a.early_confidence)}`],
    [
      t('anomalies.finalDetection'),
      a.final_category ? `${rules.label(a.final_category)} · ${fmt.pct(a.final_confidence)}` : t('anomalies.pending'),
    ],
    [t('anomalies.description'), a.final_note || a.early_note || '—'],
    [t('anomalies.position'), a.x !== null && a.y !== null ? `${a.x.toFixed(2)}, ${a.y.toFixed(2)} m` : '—'],
    [
      t('anomalies.patrol'),
      a.patrol_id ? (
        <Link className="text-accent" href={`/patrols/${a.patrol_id}`}>
          #{a.patrol_id}
        </Link>
      ) : (
        '—'
      ),
    ],
    [t('anomalies.validation'), a.validated_by ? `${a.validated_by}, ${fmt.dateTime(a.validated_at)}` : '—'],
    [t('anomalies.telegram'), a.notified_at ? fmt.dateTime(a.notified_at) : t('anomalies.notSent')],
  ];
  return (
    <>
      <PageTitle
        title={t('anomalies.detail', { id: a.id, category: rules.label(a.final_category ?? a.early_category) })}
        subtitle={`${fmt.dateTime(a.detected_at)} · ${a.robot_id}`}
        actions={
          <Link href="/anomalies" className="text-sm text-accent">
            ← {t('common.back')}
          </Link>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title={t('anomalies.image')} actions={<Badge tone={ANOMALY_TONE[a.status]}>{tx('anomalyStatus', a.status)}</Badge>}>
          <img src={api.anomalies.imageUrl(a.id)} alt="" className="w-full rounded" />
        </Panel>
        <div className="space-y-4">
          <Panel title={t('anomalies.detection')}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {a.status === 'needs_validation' && can('operate') && (
            <Panel title={t('anomalies.operatorValidation')}>
              <div className="space-y-3">
                <Field label={t('anomalies.categoryIfWrong')}>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">{rules.label(a.final_category ?? a.early_category)}</option>
                    {rules.data?.map((r) => (
                      <option key={r.category} value={r.category}>
                        {rules.label(r.category)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('anomalies.note')}>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('common.optional')} />
                </Field>
                <ErrorNote error={error} />
                <div className="flex gap-2">
                  <Button variant="ok" disabled={busy} onClick={() => decide('confirm')}>
                    {t('anomalies.confirm')}
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => decide('reject')}>
                    {t('anomalies.reject')}
                  </Button>
                </div>
              </div>
            </Panel>
          )}
          {a.x !== null &&
            a.y !== null &&
            (plan ? (
              <FloorPlanView plan={plan} className="h-72">
                {route.data?.points && <RouteLayer plan={plan} points={route.data.points} color="#64748b" />}
                <AnomalyPin plan={plan} x={a.x} y={a.y} pending={a.status === 'needs_validation'} label="" />
              </FloorPlanView>
            ) : (
              loaded && (
                <GridMapView
                  className="h-72"
                  robots={[]}
                  routes={route.data?.points ? [route.data.points] : []}
                  routeColor="#64748b"
                  anomalies={[{ id: a.id, x: a.x, y: a.y, pending: a.status === 'needs_validation', label: '' }]}
                />
              )
            ))}
        </div>
      </div>
    </>
  );
}
