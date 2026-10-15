'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { useMe } from '@/lib/session';
import type { DetectorState, Health, InspectionStatus, PeopleDetectionStatus, Telemetry } from '@/lib/types';
import { cx } from './ui';

const STATE_DOT: Record<DetectorState, string> = {
  running: 'bg-ok',
  loading: 'bg-warn',
  error: 'bg-danger',
  off: 'bg-slate-500',
};

/** Rhythm choices: 0 = continuous, > 0 = every N s, -1 = stop points only. */
const RHYTHMS = [0, 2, 5, 10, 30, 60, -1] as const;

function Switch({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50', on ? 'bg-accent' : 'bg-ink-500')}
    >
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

function StateBadge({ state, error }: { state: DetectorState; error?: string | null }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300" title={error ?? undefined}>
      <span className={cx('h-2 w-2 rounded-full', STATE_DOT[state] ?? 'bg-slate-500', state === 'loading' && 'animate-pulse')} />
      {t(`control.state.${state}`)}
    </span>
  );
}

/** Sends one control request and keeps the robot's answer (or refusal) to show it. */
function useControl() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string }>();
  const run = async (call: () => Promise<{ ok: boolean; msg: string }>) => {
    setBusy(true);
    setNote(undefined);
    try {
      const ack = await call();
      setNote({ ok: true, text: ack.msg || t('control.done') });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : t('common.failed') });
    } finally {
      setBusy(false);
    }
  };
  return { busy, note, run };
}

function Note({ note }: { note?: { ok: boolean; text: string } }) {
  if (!note) return null;
  return <div className={cx('mt-1 text-xs', note.ok ? 'text-slate-400' : 'text-danger')}>{note.text}</div>;
}

function InspectionControl({ robotId, status, online }: { robotId: string; status: InspectionStatus | null | undefined; online: boolean }) {
  const { t } = useI18n();
  const { can } = useMe();
  const models = useAsync(() => api.inspectionModels().catch(() => [] as string[]), []);
  const { busy, note, run } = useControl();
  const operate = can('operate') && online && !!status;
  const rhythm = status ? (status.interval_sec < 0 ? -1 : status.interval_sec) : 0;
  const rhythmLabel = (v: number) => (v === 0 ? t('control.continuous') : v < 0 ? t('control.stopPoints') : t('control.every', { n: v }));
  const modelList = [...new Set([...(models.data ?? []), ...(status?.model ? [status.model] : [])])];
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-200">{t('control.inspection')}</span>
        <div className="flex items-center gap-2">
          {status ? <StateBadge state={status.state} error={status.error} /> : <span className="text-xs text-slate-500">—</span>}
          {operate && (
            <Switch
              on={status!.enabled}
              disabled={busy}
              label={t('control.inspection')}
              onChange={(v) => run(() => api.robots.inspection(robotId, { enabled: v }))}
            />
          )}
        </div>
      </div>
      {status && (
        <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
          <label className="min-w-0">
            <span className="text-slate-500">{t('control.model')}</span>
            {operate ? (
              <select
                value={status.model ?? ''}
                disabled={busy}
                onChange={(e) => run(() => api.robots.inspection(robotId, { model: e.target.value }))}
                className="mt-0.5 w-full truncate rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-slate-200"
              >
                {!status.model && <option value="">—</option>}
                {modelList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <div className="truncate font-mono text-slate-200">{status.model ?? '—'}</div>
            )}
          </label>
          <label className="min-w-0">
            <span className="text-slate-500">{t('control.rhythm')}</span>
            {operate ? (
              <select
                value={rhythm}
                disabled={busy}
                onChange={(e) => run(() => api.robots.inspection(robotId, { interval: Number(e.target.value) }))}
                className="mt-0.5 w-full rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-slate-200"
              >
                {!RHYTHMS.includes(rhythm as (typeof RHYTHMS)[number]) && <option value={rhythm}>{rhythmLabel(rhythm)}</option>}
                {RHYTHMS.map((v) => (
                  <option key={v} value={v}>
                    {rhythmLabel(v)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-slate-200">{rhythmLabel(rhythm)}</div>
            )}
          </label>
        </div>
      )}
      {status?.state === 'error' && status.error && <div className="mt-1 text-xs text-danger">{status.error}</div>}
      <Note note={note} />
    </div>
  );
}

function PeopleControl({
  robotId,
  status,
  people,
  online,
}: {
  robotId: string;
  status: PeopleDetectionStatus | null | undefined;
  people: number;
  online: boolean;
}) {
  const { t } = useI18n();
  const { can } = useMe();
  const { busy, note, run } = useControl();
  const operate = can('operate') && online && !!status;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-200">{t('control.people')}</span>
        <div className="flex items-center gap-2">
          {status ? <StateBadge state={status.state} error={status.error} /> : <span className="text-xs text-slate-500">—</span>}
          {operate && (
            <Switch
              on={status!.enabled}
              disabled={busy}
              label={t('control.people')}
              onChange={(v) => run(() => api.robots.people(robotId, v))}
            />
          )}
        </div>
      </div>
      {status && (
        <div className="mt-1 flex items-baseline justify-between text-xs">
          <span className="text-slate-500">
            {t('control.peopleNow')}
            {status.backend && <span className="ml-1 font-mono text-slate-600">({status.backend})</span>}
          </span>
          <span className="font-mono text-base text-slate-100">{status.enabled ? (status.count ?? people) : '—'}</span>
        </div>
      )}
      {status?.state === 'error' && status.error && <div className="mt-1 text-xs text-danger">{status.error}</div>}
      <Note note={note} />
    </div>
  );
}

function Gauge({ label, value, text }: { label: string; value: number | null | undefined; text?: string }) {
  const hot = value !== null && value !== undefined && value >= 90;
  return (
    <div className="min-w-0">
      <div className="text-slate-500">{label}</div>
      <div className={cx('font-mono', hot ? 'text-danger' : 'text-slate-200')}>
        {value === null || value === undefined ? '—' : (text ?? `${Math.round(value)}%`)}
      </div>
      <div className="mt-0.5 h-1 rounded-full bg-ink-600">
        {value !== null && value !== undefined && (
          <div
            className={cx('h-1 rounded-full', hot ? 'bg-danger' : 'bg-accent')}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        )}
      </div>
    </div>
  );
}

/** CPU, GPU, RAM and temperature of the robot computer; red from 90 % (90 °C). */
export function RobotLoad({ health }: { health: Health | null | undefined }) {
  const { t } = useI18n();
  const used = health?.memory_used_gb;
  const total = health?.memory_total_gb;
  const mem = health?.memory_percent ?? (used && total ? (used / total) * 100 : null);
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-200">{t('control.load')}</div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <Gauge label="CPU" value={health?.cpu_percent} />
        <Gauge label="GPU" value={health?.gpu_percent} />
        <Gauge label="RAM" value={mem} text={used && total ? `${used.toFixed(1)}/${total.toFixed(1)} GB` : undefined} />
        <Gauge
          label={t('control.temp')}
          value={health?.cpu_temp_c}
          text={health?.cpu_temp_c != null ? `${Math.round(health.cpu_temp_c)} °C` : undefined}
        />
      </div>
    </div>
  );
}

/** AI inspection, people detection and computer load of one robot, with controls for operators. */
export function RobotControls({ robotId, telemetry, online }: { robotId: string; telemetry: Telemetry | null; online: boolean }) {
  return (
    <div className="space-y-3">
      <InspectionControl robotId={robotId} status={telemetry?.inspection} online={online} />
      <PeopleControl robotId={robotId} status={telemetry?.people_detection} people={telemetry?.people ?? 0} online={online} />
      <RobotLoad health={telemetry?.health} />
    </div>
  );
}
