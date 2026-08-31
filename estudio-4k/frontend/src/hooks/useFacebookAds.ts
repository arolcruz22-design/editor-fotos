// hooks/useFacebookAds.ts
// Adaptado del blueprint original: ahora todas las llamadas se hacen contra
// la cuenta de Facebook Ads seleccionada (accountId), lo que permite operar
// varias cuentas publicitarias desde el mismo dashboard.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { AdCampaign, CampaignInsights, CreateCampaignPayload } from '../types';

interface CreateCreativePayload {
  name: string;
  pageId: string;
  imageUrl?: string;
  message: string;
  link: string;
  linkTitle: string;
  generationJobId?: string;
}

interface UseFacebookAdsReturn {
  campaigns: AdCampaign[];
  loading: boolean;
  error: string | null;
  getCampaigns: () => Promise<void>;
  createCampaign: (payload: CreateCampaignPayload) => Promise<AdCampaign>;
  createCreative: (payload: CreateCreativePayload) => Promise<{ id: string }>;
  pauseCampaign: (campaignId: string) => Promise<void>;
  activateCampaign: (campaignId: string) => Promise<void>;
  getCampaignInsights: (campaignId: string) => Promise<CampaignInsights>;
}

export const useFacebookAds = (accountId: string | null): UseFacebookAdsReturn => {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCampaigns = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/facebook-ads/${accountId}/campaigns`);
      setCampaigns(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Error obteniendo campañas.');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const createCampaign = useCallback(
    async (payload: CreateCampaignPayload): Promise<AdCampaign> => {
      if (!accountId) throw new Error('Selecciona una cuenta de Facebook Ads primero.');
      setLoading(true);
      try {
        const { data } = await api.post(`/facebook-ads/${accountId}/campaigns`, payload);
        setCampaigns((prev) => [data, ...prev]);
        setError(null);
        return data as AdCampaign;
      } catch (err: any) {
        const message = err.response?.data?.error ?? 'Error creando campaña.';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [accountId]
  );

  const createCreative = useCallback(
    async (payload: CreateCreativePayload) => {
      if (!accountId) throw new Error('Selecciona una cuenta de Facebook Ads primero.');
      const { data } = await api.post(`/facebook-ads/${accountId}/creatives`, payload);
      return data as { id: string };
    },
    [accountId]
  );

  const pauseCampaign = useCallback(
    async (campaignId: string) => {
      if (!accountId) return;
      await api.post(`/facebook-ads/${accountId}/campaigns/${campaignId}/pause`);
      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: 'PAUSED' } : c)));
    },
    [accountId]
  );

  const activateCampaign = useCallback(
    async (campaignId: string) => {
      if (!accountId) return;
      await api.post(`/facebook-ads/${accountId}/campaigns/${campaignId}/activate`);
      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: 'ACTIVE' } : c)));
    },
    [accountId]
  );

  const getCampaignInsights = useCallback(
    async (campaignId: string): Promise<CampaignInsights> => {
      if (!accountId) throw new Error('Selecciona una cuenta de Facebook Ads primero.');
      const { data } = await api.get(`/facebook-ads/${accountId}/campaigns/${campaignId}/insights`);
      return data;
    },
    [accountId]
  );

  useEffect(() => {
    setCampaigns([]);
    if (accountId) getCampaigns();
  }, [accountId, getCampaigns]);

  return {
    campaigns,
    loading,
    error,
    getCampaigns,
    createCampaign,
    createCreative,
    pauseCampaign,
    activateCampaign,
    getCampaignInsights,
  };
};
