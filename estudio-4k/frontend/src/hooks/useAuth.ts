import { useCallback, useState } from 'react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';

export function useAuth() {
  const { token, user, setSession, logout } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setSession(data.token, data.user);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'No se pudo iniciar sesión.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/auth/register', { email, password, fullName });
      setSession(data.token, data.user);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'No se pudo crear la cuenta.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setSession]);

  return { token, user, isAuthenticated: !!token, login, register, logout, loading, error };
}
