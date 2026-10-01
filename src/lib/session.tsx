'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { api } from './api';
import { useAsync } from './hooks';
import type { Me, Permission } from './types';

const MeContext = createContext<{ me: Me | undefined; can: (p: Permission) => boolean }>({
  me: undefined,
  can: () => false,
});

export function MeProvider({ children }: { children: ReactNode }) {
  const me = useAsync(() => api.me(), []);
  const can = (p: Permission) => !!me.data?.permissions.includes(p);
  return <MeContext.Provider value={{ me: me.data, can }}>{children}</MeContext.Provider>;
}

/** Current user and a permission check for hiding or disabling controls. */
export const useMe = () => useContext(MeContext);
