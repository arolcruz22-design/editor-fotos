export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'editor';
}

export interface FbAdAccount {
  id: string;
  label: string;
  adAccountId: string;
  businessId: string | null;
  currency: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
}

export interface HiggsFieldJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  completedAt?: string;
  result?: {
    url: string;
    format: 'webp' | 'mp4' | 'webm';
    fileSize: number;
    duration?: number;
    resolution: '4k' | '1080p';
  };
  error?: string;
}

export interface GenerateOptions {
  prompt: string;
  quality: 'standard' | '4k';
  format: 'webp' | 'mp4';
  duration?: number;
  optimize: boolean;
  lighting?: LightingSettings;
}

export interface LightingSettings {
  red: number;
  green: number;
  blue: number;
  colorTemperatureK: number;
  intensityPercent: number;
}

export interface LightingPreset {
  id: string;
  name: string;
  settings: LightingSettings;
  created_at: string;
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

export interface CampaignInsights {
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  spend?: string;
  reach?: string;
  frequency?: string;
}
