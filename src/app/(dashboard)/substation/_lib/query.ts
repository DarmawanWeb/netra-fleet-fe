'use client';

import { useEffect, useState } from 'react';

/** The page's query string, read after mount (the export is static, so the server never sees it). */
export function useQuery() {
  const [query, setQuery] = useState<URLSearchParams | null>(null);
  useEffect(() => setQuery(new URLSearchParams(window.location.search)), []);
  return query;
}
