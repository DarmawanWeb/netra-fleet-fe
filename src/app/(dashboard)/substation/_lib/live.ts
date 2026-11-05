'use client';

import { useEffect, useState } from 'react';
import { useLive } from '@/lib/live';

/**
 * A number that changes whenever a robot uploads an inspection or a finding changes anywhere, so
 * substation pages refetch with it in their dependencies. Bursts (a capture opening several
 * findings) are coalesced into one change.
 */
export function useSubstationRevision() {
  const { subscribe } = useLive();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = subscribe((msg) => {
      if (msg.type !== 'inspection' && msg.type !== 'finding') return;
      clearTimeout(timer);
      timer = setTimeout(() => setRevision((r) => r + 1), 400);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [subscribe]);
  return revision;
}
