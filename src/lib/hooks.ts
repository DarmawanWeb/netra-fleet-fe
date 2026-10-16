'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n, type MessageKey } from '@/i18n';
import { api } from './api';
import type { FloorPlan, Rule } from './types';

export interface Async<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
}

/** Run an async loader whenever deps change; reload() reruns it. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): Async<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    run()
      .then((d) => alive && (setData(d), setError(undefined)))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [run, tick]);
  return { data, error, loading, reload: useCallback(() => setTick((t) => t + 1), []) };
}

/** Anomaly rules with a label lookup: built-in categories are translated, custom ones use their rule label. */
export function useRules() {
  const { t, locale } = useI18n();
  const rules = useAsync(() => api.rules.list(), []);
  const label = useMemo(() => {
    const map = new Map((rules.data ?? []).map((r: Rule) => [r.category, r.label]));
    return (category: string | null | undefined) => {
      if (!category) return '—';
      const builtIn = ['trash', 'spill', 'floor_damage', 'fallen_person', 'unknown'].includes(category);
      return builtIn ? t(`category.${category}` as MessageKey) : (map.get(category) ?? category.replace(/_/g, ' '));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules.data, locale]);
  return { ...rules, label };
}

/**
 * The floor plan to draw on: the preferred one if it is calibrated, else the first calibrated one.
 * Without a calibrated plan (`plan` undefined once `loaded`), maps use the grid in map coordinates.
 */
export function useCalibratedPlan(preferred?: number | null) {
  const plans = useAsync(() => api.floorPlans.list(), []);
  const calibrated = useMemo(() => (plans.data ?? []).filter((p: FloorPlan) => p.px_per_m > 0), [plans.data]);
  const plan = calibrated.find((p) => p.id === preferred) ?? calibrated[0];
  return { plan, calibrated, loaded: plans.data !== undefined };
}
