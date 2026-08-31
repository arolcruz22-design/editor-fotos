import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FbAdAccount, User } from '../types';

interface AppState {
  token: string | null;
  user: User | null;
  accounts: FbAdAccount[];
  selectedAccountId: string | null;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  setAccounts: (accounts: FbAdAccount[]) => void;
  selectAccount: (id: string) => void;
}

// Estado global: sesión + cuentas de Facebook conectadas + cuál está activa
// en el dashboard. Persistido en localStorage para no perder la sesión al recargar.
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      accounts: [],
      selectedAccountId: null,
      setSession: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null, accounts: [], selectedAccountId: null }),
      setAccounts: (accounts) =>
        set((state) => ({
          accounts,
          selectedAccountId:
            state.selectedAccountId && accounts.some((a) => a.id === state.selectedAccountId)
              ? state.selectedAccountId
              : (accounts[0]?.id ?? null),
        })),
      selectAccount: (id) => set({ selectedAccountId: id }),
    }),
    { name: 'estudio4k-session' }
  )
);
