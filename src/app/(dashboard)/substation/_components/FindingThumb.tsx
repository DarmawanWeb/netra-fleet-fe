'use client';

import { useState } from 'react';
import { cx } from '@/components/ui';
import { api } from '@/lib/api';
import type { Finding } from '@/lib/types';

/** The image of a finding's latest capture (thermal, or acoustic for partial discharge), or the empty ironbow tile. */
export function FindingThumb({ finding, className }: { finding: Pick<Finding, 'kind' | 'last_inspection_id'>; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cx('relative shrink-0 overflow-hidden rounded bg-black', className)}>
      {failed ? (
        <div className="thermal-empty absolute inset-0" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={api.substation.imageUrl(finding.last_inspection_id, finding.kind === 'pd' ? 'acoustic' : 'thermal')}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}
