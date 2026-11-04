'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { api, isLicensed, setLicensedFeatures } from './api';
import { useAsync } from './hooks';
import type { Feature, Me, Permission, ServerInfo } from './types';

interface Session {
  me: Me | undefined;
  /** Server info: robot address, licensed modules, license, branding. */
  info: ServerInfo | undefined;
  can: (p: Permission) => boolean;
  /** Whether the license includes a feature module (the core needs none). */
  has: (f: Feature) => boolean;
  /** Reads /info again, e.g. after a license upload. */
  reloadInfo: () => void;
}

const MeContext = createContext<Session>({
  me: undefined,
  info: undefined,
  can: () => false,
  has: () => false,
  reloadInfo: () => undefined,
});

/**
 * Current user and license. Children render once /info has answered, so every page fetches with
 * the licensed modules known. A failed /info leaves every module on; the server still refuses
 * what the license does not include.
 */
export function MeProvider({ children }: { children: ReactNode }) {
  const me = useAsync(() => api.me(), []);
  const info = useAsync(
    () =>
      api.info().then(
        (i) => (setLicensedFeatures(i.features), i),
        (e: unknown) => (setLicensedFeatures(undefined), Promise.reject(e)),
      ),
    [],
  );
  const ready = info.data !== undefined || info.error !== undefined;
  const features = info.data?.features;
  const value = useMemo<Session>(
    () => ({
      me: me.data,
      info: info.data,
      can: (p) => !!me.data?.permissions.includes(p),
      // features in the deps: isLicensed reads the module-level set that changes with them.
      has: (f) => (features ? features.includes(f) : isLicensed(f)),
      reloadInfo: info.reload,
    }),
    [me.data, info.data, info.reload, features],
  );
  return <MeContext.Provider value={value}>{ready ? children : null}</MeContext.Provider>;
}

/** Current user, permission and license checks for hiding or disabling controls. */
export const useMe = () => useContext(MeContext);
