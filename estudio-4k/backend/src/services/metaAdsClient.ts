import axios from 'axios';
import { config } from '../config.js';

// Cliente del Meta Graph API (Facebook/Instagram Ads) diseñado para trabajar
// con MÚLTIPLES cuentas publicitarias: cada llamada recibe el access_token y
// el ad_account_id de la cuenta seleccionada en el panel (ver routes/facebookAds.ts).

export interface MetaAdAccountRef {
  accessToken: string;
  adAccountId: string; // formato act_XXXXXXXXXX
}

export interface AdCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'PENDING_REVIEW' | 'ARCHIVED';
  objective: string;
  daily_budget?: string;
  created_time: string;
}

export interface CreateCampaignPayload {
  name: string;
  objective: 'REACH' | 'OUTCOME_TRAFFIC' | 'OUTCOME_ENGAGEMENT' | 'OUTCOME_SALES' | 'OUTCOME_LEADS';
  dailyBudgetCents: number;
  status?: 'ACTIVE' | 'PAUSED';
}

function graph() {
  return axios.create({
    baseURL: `https://graph.facebook.com/${config.meta.graphApiVersion}`,
    timeout: 30_000,
  });
}

export async function verifyAccessToken(accessToken: string): Promise<{ id: string; name?: string }> {
  const { data } = await graph().get('/me', { params: { access_token: accessToken, fields: 'id,name' } });
  return data;
}

export async function listCampaigns(ref: MetaAdAccountRef): Promise<AdCampaign[]> {
  const { data } = await graph().get(`/${ref.adAccountId}/campaigns`, {
    params: {
      access_token: ref.accessToken,
      fields: 'id,name,status,objective,daily_budget,created_time',
      limit: 100,
    },
  });
  return data.data;
}

export async function createCampaign(ref: MetaAdAccountRef, payload: CreateCampaignPayload): Promise<AdCampaign> {
  const { data } = await graph().post(`/${ref.adAccountId}/campaigns`, null, {
    params: {
      access_token: ref.accessToken,
      name: payload.name,
      objective: payload.objective,
      status: payload.status ?? 'PAUSED',
      special_ad_categories: JSON.stringify([]),
    },
  });
  // Meta devuelve solo { id }; recuperamos el objeto completo.
  const { data: full } = await graph().get(`/${data.id}`, {
    params: { access_token: ref.accessToken, fields: 'id,name,status,objective,daily_budget,created_time' },
  });
  return full;
}

export async function setCampaignStatus(
  ref: MetaAdAccountRef,
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED'
): Promise<void> {
  await graph().post(`/${campaignId}`, null, {
    params: { access_token: ref.accessToken, status },
  });
}

export async function uploadImageCreative(
  ref: MetaAdAccountRef,
  imageUrl: string
): Promise<{ imageHash: string }> {
  const { data } = await graph().post(`/${ref.adAccountId}/adimages`, null, {
    params: { access_token: ref.accessToken, url: imageUrl },
  });
  const firstKey = Object.keys(data.images)[0];
  return { imageHash: data.images[firstKey].hash };
}

export async function createAdCreative(
  ref: MetaAdAccountRef,
  params: { name: string; pageId: string; imageHash?: string; message: string; link: string; linkTitle: string }
): Promise<{ id: string }> {
  const objectStorySpec: Record<string, unknown> = {
    page_id: params.pageId,
    link_data: {
      link: params.link,
      message: params.message,
      name: params.linkTitle,
      ...(params.imageHash ? { image_hash: params.imageHash } : {}),
    },
  };
  const { data } = await graph().post(`/${ref.adAccountId}/adcreatives`, null, {
    params: {
      access_token: ref.accessToken,
      name: params.name,
      object_story_spec: JSON.stringify(objectStorySpec),
    },
  });
  return data;
}

export async function getCampaignInsights(ref: MetaAdAccountRef, campaignId: string) {
  const { data } = await graph().get(`/${campaignId}/insights`, {
    params: {
      access_token: ref.accessToken,
      fields: 'impressions,clicks,ctr,cpc,spend,reach,frequency',
      date_preset: 'last_30d',
    },
  });
  return data.data?.[0] ?? null;
}

export async function listOwnedAdAccounts(accessToken: string): Promise<Array<{ id: string; name: string; currency: string; account_status: number }>> {
  const { data } = await graph().get('/me/adaccounts', {
    params: { access_token: accessToken, fields: 'id,name,currency,account_status', limit: 200 },
  });
  return data.data;
}
