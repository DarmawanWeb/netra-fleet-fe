'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IconAlert, IconInfo, IconOctagon } from '@/components/icons';
import { Button, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useMe } from '@/lib/session';
import type { Anomaly, Robot, RoutePoint } from '@/lib/types';
import { formatOffset, type RobotIssue, type Severity } from '../_lib/attention';
import { stopNumber } from '../_lib/stops';

const SEVERITY: Record<Severity, { Icon: typeof IconOctagon; text: string }> = {
  critical: { Icon: IconOctagon, text: 'text-danger' },
  warning: { Icon: IconAlert, text: 'text-warn' },
  info: { Icon: IconInfo, text: 'text-accent' },
};

function SeverityIcon({ severity }: { severity: Severity }) {
  const { Icon, text } = SEVERITY[severity];
  return <Icon width={18} height={18} className={cx('mt-0.5 shrink-0', text)} aria-label={severity} />;
}

function IssueRow({ issue }: { issue: RobotIssue }) {
  const { t, tx } = useI18n();
  const { can } = useMe();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const units = { d: t('time.d'), h: t('time.h'), min: t('time.min'), s: t('time.s') };
  const title = {
    estop: t('dashboard.estopEngaged'),
    alarm: tx('navState', issue.state),
    field: t('dashboard.fieldStale'),
    health: issue.severity === 'critical' ? t('dashboard.healthError') : t('dashboard.healthWarn'),
    battery: t('dashboard.batteryLow', { pct: Math.round(issue.value ?? 0) }),
    lost: t('dashboard.lostDuringPatrol'),
    clock: t('dashboard.clockSkew', { offset: formatOffset(issue.value ?? 0, units) }),
  }[issue.kind];
  const detail = issue.kind === 'estop' ? t('dashboard.estopHint') : issue.detail || undefined;
  const release = async () => {
    if (!confirm(t('dashboard.confirmRelease', { name: issue.robot.name }))) return;
    setBusy(true);
    try {
      await api.robots.command(issue.robot.id, 'estop_release');
      setNote(t('robot.commandSent'));
    } catch (e) {
      setNote(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex gap-3 px-4 py-2.5">
      <SeverityIcon severity={issue.severity} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-100">{title}</div>
        <div className="text-xs text-slate-400">
          <Link href={`/robots/${issue.robot.id}`} className="text-slate-300 hover:text-accent">
            {issue.robot.name}
          </Link>
          {detail && (
            <span className="block truncate text-slate-500" title={detail}>
              {detail}
            </span>
          )}
          {note && <span className="block text-slate-500">{note}</span>}
        </div>
      </div>
      {issue.kind === 'estop' && can('operate') && (
        <Button className="shrink-0 self-center px-2.5 py-1 text-xs" disabled={busy} onClick={release}>
          {t('dashboard.release')}
        </Button>
      )}
    </li>
  );
}

function ValidationRow({
  anomaly,
  robot,
  showRobot,
  points,
  label,
}: {
  anomaly: Anomaly;
  robot?: Robot;
  showRobot: boolean;
  points?: RoutePoint[];
  label: (c: string) => string;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const { can } = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const category = anomaly.final_category ?? anomaly.early_category;
  const confidence = anomaly.final_confidence ?? anomaly.early_confidence;
  const decide = async (decision: 'confirm' | 'reject') => {
    setBusy(true);
    setError(undefined);
    try {
      await api.anomalies.validate(anomaly.id, decision, category);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
      setBusy(false);
    }
  };
  return (
    <li className={cx('flex gap-3 px-4 py-2.5 transition-opacity', busy && 'opacity-50')}>
      <Link href={`/anomalies/${anomaly.id}`} className="shrink-0" aria-label={`${t('dashboard.open')} #${anomaly.id}`}>
        <img
          src={api.anomalies.imageUrl(anomaly.id)}
          alt={label(category)}
          loading="lazy"
          className="h-14 w-20 rounded-md border border-ink-600 bg-ink-800 object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link href={`/anomalies/${anomaly.id}`} className="truncate text-sm font-medium text-slate-100 hover:text-accent">
            {label(category)}
          </Link>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{fmt.ago(anomaly.detected_at)}</span>
        </div>
        <div className="truncate text-xs text-slate-400">
          {[
            showRobot && (robot?.name ?? anomaly.robot_id),
            anomaly.stop_index !== null && t('dashboard.atStop', { n: stopNumber(points, anomaly.stop_index) }),
            t('dashboard.confidence', { pct: fmt.pct(confidence) }),
          ]
            .filter(Boolean)
            .join(', ')}
        </div>
        {error && <div className="text-xs text-danger">{error}</div>}
        {can('operate') && (
          <div className="mt-1.5 flex gap-1.5">
            <Button variant="ok" className="px-2.5 py-0.5 text-xs" disabled={busy} onClick={() => decide('confirm')}>
              {t('dashboard.confirm')}
            </Button>
            <Button className="px-2.5 py-0.5 text-xs" disabled={busy} onClick={() => decide('reject')}>
              {t('dashboard.reject')}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

/** One queue for everything waiting on a person: robot problems first, then detections to validate. */
export function Attention({
  issues,
  pending,
  robots,
  routePoints,
  label,
}: {
  issues: RobotIssue[];
  pending: Anomaly[];
  robots: Robot[];
  routePoints: Record<number, RoutePoint[]>;
  label: (c: string) => string;
}) {
  const { t } = useI18n();
  const count = issues.filter((i) => i.severity !== 'info').length + pending.length;
  const newest = [...pending].sort((a, b) => b.detected_at.localeCompare(a.detected_at));
  return (
    <section className="flex min-h-0 flex-col" aria-labelledby="attention-title">
      <header className="flex items-center justify-between px-4 pb-1.5 pt-3">
        <h2 id="attention-title" className="text-[13px] font-semibold text-slate-200">
          {t('dashboard.attention')}
        </h2>
        {count > 0 && (
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-warn ring-1 ring-warn/40">
            {count}
          </span>
        )}
      </header>
      {issues.length + pending.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-slate-500">{t('dashboard.allClear')}</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-ink-700 overflow-y-auto">
          {issues.map((issue) => (
            <IssueRow key={issue.key} issue={issue} />
          ))}
          {newest.map((a) => (
            <ValidationRow
              key={a.id}
              anomaly={a}
              robot={robots.find((r) => r.id === a.robot_id)}
              showRobot={robots.length > 1}
              points={a.route_id ? routePoints[a.route_id] : undefined}
              label={label}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
