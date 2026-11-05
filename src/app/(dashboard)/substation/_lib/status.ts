import type { Tone } from '@/lib/labels';
import type { FindingStatus } from '@/lib/types';

/** Badge tone of a finding's status: open asks for someone, acknowledged is in hand. */
export const STATUS_TONE: Record<FindingStatus, Tone> = { open: 'danger', acknowledged: 'warn', resolved: 'muted' };
