import { ALARM_STATES } from '@/lib/labels';
import type { Patrol, Robot, Telemetry } from '@/lib/types';

export type Severity = 'critical' | 'warning' | 'info';

/** Something about a robot that a person should look at, most urgent first. */
export interface RobotIssue {
  key: string;
  robot: Robot;
  severity: Severity;
  /** What happened: a message key of the dashboard, or a navigation state. */
  kind: 'estop' | 'alarm' | 'field' | 'health' | 'battery' | 'lost' | 'clock';
  /** Navigation state of an alarm. */
  state?: string;
  detail?: string;
  value?: number;
}

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** Robot problems from live telemetry, connection state and today's patrols. */
export function robotIssues(
  robots: Robot[],
  telemetry: Record<string, Telemetry>,
  online: Record<string, boolean>,
  patrols: Patrol[],
): RobotIssue[] {
  const out: RobotIssue[] = [];
  for (const robot of robots) {
    const isOnline = online[robot.id] ?? robot.online;
    const tel = telemetry[robot.id] ?? robot.last_telemetry;
    const add = (issue: Omit<RobotIssue, 'key' | 'robot'>) => out.push({ key: `${robot.id}:${issue.kind}`, robot, ...issue });
    if (!isOnline) {
      if (patrols.some((p) => p.robot_id === robot.id && p.status === 'running')) add({ kind: 'lost', severity: 'critical' });
      continue;
    }
    if (!tel) continue;
    if (tel.estop) add({ kind: 'estop', severity: 'critical' });
    else if (ALARM_STATES.has(tel.nav.state)) add({ kind: 'alarm', severity: 'critical', state: tel.nav.state, detail: tel.nav.message });
    if (tel.field === 'stale' && !tel.estop) add({ kind: 'field', severity: 'critical' });
    const level = tel.health?.level ?? (tel.health && !tel.health.ok ? 'warn' : 'ok');
    // An engaged e-stop already has its own item; its echo in the health summary is left out.
    const healthIssues = (tel.health?.issues ?? []).filter((i) => !(tel.estop && /e-stop/i.test(i)));
    if (level !== 'ok' && healthIssues.length) {
      add({ kind: 'health', severity: level === 'error' ? 'critical' : 'warning', detail: healthIssues.join(', ') });
    }
    const pct = tel.battery?.pct;
    if (pct !== null && pct !== undefined && pct < 25) add({ kind: 'battery', severity: pct < 10 ? 'critical' : 'warning', value: pct });
    const skew = robot.clock_skew_s;
    if (skew !== null && skew !== undefined && Math.abs(skew) >= 60) add({ kind: 'clock', severity: 'info', value: skew });
  }
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

/** "2 h 5 min" style offset for a clock skew in seconds. */
export function formatOffset(seconds: number, units: { d: string; h: string; min: string; s: string }): string {
  const s = Math.abs(Math.round(seconds));
  if (s < 60) return `${s} ${units.s}`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} ${units.min}`;
  const h = Math.floor(min / 60);
  if (h >= 48) return `${Math.round(h / 24)} ${units.d}`;
  return `${h} ${units.h} ${min % 60} ${units.min}`;
}
