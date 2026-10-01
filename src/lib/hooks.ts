'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Rule } from './types';

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

/** Anomaly rules with a label lookup that falls back to the raw category. */
export function useRules() {
  const rules = useAsync(() => api.rules.list(), []);
  const label = useMemo(() => {
    const map = new Map((rules.data ?? []).map((r: Rule) => [r.category, r.label]));
    return (category: string | null | undefined) => (category ? map.get(category) ?? category.replace(/_/g, ' ') : '—');
  }, [rules.data]);
  return { ...rules, label };
}
