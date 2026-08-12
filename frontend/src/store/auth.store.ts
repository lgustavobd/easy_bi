import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Organization = { id: string; name: string; slug: string; role?: string; themeConfig?: any; planId?: string; plan?: any };
type User = { id: string; name: string; email: string; isSuperAdmin: boolean };

export const GLOBAL_ADMIN_ORGANIZATION: Organization = {
  id: '',
  name: 'Administração Global SaaS',
  slug: 'global',
  role: 'SUPER_ADMIN',
  themeConfig: { accent: 'ORANGE' }
};

type AuthState = {
  user?: User;
  organizations: Organization[];
  organization?: Organization;
  accessToken?: string;
  refreshToken?: string;
  setSession: (payload: any) => void;
  setOrganization: (organization: Organization) => void;
  updateCurrentOrganization: (payload: Partial<Organization>) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      organizations: [],
      setSession: (payload) => {
        const isSuperAdmin = Boolean(payload.user?.isSuperAdmin);
        set({
          user: payload.user,
          organizations: isSuperAdmin ? [] : payload.organizations || [],
          organization: isSuperAdmin ? GLOBAL_ADMIN_ORGANIZATION : get().organization,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken
        });
      },
      setOrganization: (organization) => set({ organization }),
      updateCurrentOrganization: (payload) => {
        const current = get().organization;
        const next = current ? { ...current, ...payload } : current;
        set({
          organization: next,
          organizations: get().organizations.map((org) => org.id === next?.id ? { ...org, ...payload } : org)
        });
      },
      logout: () => set({ user: undefined, organizations: [], organization: undefined, accessToken: undefined, refreshToken: undefined })
    }),
    { name: 'easy-bi-session' }
  )
);
