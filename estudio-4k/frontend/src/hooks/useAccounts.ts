import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { FbAdAccount } from '../types';

interface ConnectPayload {
  label: string;
  adAccountId: string;
  accessToken: string;
  businessId?: string;
  currency?: string;
  timezone?: string;
}

// Administra las MÚLTIPLES cuentas de Facebook Ads conectadas al panel
// (una por tienda/marca de Todomotos) y cuál está seleccionada en el dashboard.
export function useAccounts() {
  const { accounts, setAccounts, selectedAccountId, selectAccount, token } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<FbAdAccount[]>('/accounts');
      setAccounts(data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Error cargando cuentas de Facebook.');
    } finally {
      setLoading(false);
    }
  }, [setAccounts]);

  useEffect(() => {
    if (token) refresh();
  }, [token, refresh]);

  const discover = useCallback(async (accessToken: string) => {
    const { data } = await api.post('/accounts/discover', { accessToken });
    return data.accounts as Array<{ id: string; name: string; currency: string; account_status: number }>;
  }, []);

  const connect = useCallback(
    async (payload: ConnectPayload) => {
      const { data } = await api.post<FbAdAccount>('/accounts', payload);
      setAccounts([data, ...accounts]);
      selectAccount(data.id);
      return data;
    },
    [accounts, setAccounts, selectAccount]
  );

  const disconnect = useCallback(
    async (id: string) => {
      await api.delete(`/accounts/${id}`);
      setAccounts(accounts.filter((a) => a.id !== id));
    },
    [accounts, setAccounts]
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  return {
    accounts,
    selectedAccount,
    selectedAccountId,
    selectAccount,
    loading,
    error,
    refresh,
    discover,
    connect,
    disconnect,
  };
}
