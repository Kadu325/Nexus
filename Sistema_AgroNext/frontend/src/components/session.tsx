'use client';

import * as React from 'react';
import { api } from '@/lib/api';

export type Role = 'ADMIN' | 'PMO' | 'GERENTE' | 'MEMBRO' | 'LEITOR';

export interface Me {
  user: { id: string; username: string; name: string; email: string | null };
  role: Role;
  organization: { id: string; name: string; timezone: string; currency: string; locale: string };
  organizations: { id: string; name: string; role: Role }[];
}

interface Member {
  id: string;
  name: string;
  role: Role;
}

interface SessionValue {
  me: Me | null;
  members: Member[];
  reload: () => Promise<void>;
  can: (roles: Role[]) => boolean;
  memberName: (id?: string | null) => string;
}

const SessionContext = React.createContext<SessionValue | null>(null);

export const ROLES = {
  MANAGE: ['ADMIN', 'PMO', 'GERENTE'] as Role[],
  PMO: ['ADMIN', 'PMO'] as Role[],
  ADMIN: ['ADMIN'] as Role[],
  WORKERS: ['ADMIN', 'PMO', 'GERENTE', 'MEMBRO'] as Role[],
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = React.useState<Me | null>(null);
  const [members, setMembers] = React.useState<Member[]>([]);

  const reload = React.useCallback(async () => {
    const [m, ms] = await Promise.all([api<Me>('/auth/me'), api<Member[]>('/members')]);
    setMe(m);
    setMembers(ms);
  }, []);

  React.useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);

  const value = React.useMemo<SessionValue>(
    () => ({
      me,
      members,
      reload,
      // apenas orientação de interface: a autorização real é feita pela API
      can: (roles) => !!me && roles.includes(me.role),
      memberName: (id) => (id ? members.find((m) => m.id === id)?.name ?? '—' : '—'),
    }),
    [me, members, reload],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error('useSession fora do SessionProvider');
  return ctx;
}
