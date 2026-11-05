'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** The start page is the dashboard (the server redirects too; this covers a plain static host). */
export default function Home() {
  const router = useRouter();
  useEffect(() => router.replace('/dashboard'), [router]);
  return null;
}
