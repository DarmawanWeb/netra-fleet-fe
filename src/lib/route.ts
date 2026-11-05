'use client';

import { usePathname } from 'next/navigation';

/**
 * The id of a detail page (/anomalies/12), read from the address: the static export holds one
 * page per detail route and the server answers it for every id, so the route parameter itself
 * would be the exported placeholder.
 */
export function useRouteParam(): string {
  const segments = usePathname().split('/').filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? '');
}
