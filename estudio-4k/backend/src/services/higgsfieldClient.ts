import axios from 'axios';
import { config } from '../config.js';

// Cliente del API de Higgsfield.ai para generación de contenido 4K optimizado
// (WebP/VP9). Ver docs: https://docs.higgsfield.ai/

export interface GenerateContentOptions {
  prompt: string;
  quality: 'standard' | '4k';
  format: 'webp' | 'mp4';
  duration?: number;
  optimize: boolean;
  lighting?: Record<string, unknown>;
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

function client() {
  if (!config.higgsfield.apiKey) {
    throw new Error('HIGGSFIELD_API_KEY no está configurado en el backend (.env).');
  }
  return axios.create({
    baseURL: config.higgsfield.baseUrl,
    headers: {
      Authorization: `Bearer ${config.higgsfield.apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 30_000,
  });
}

export async function generateContent(options: GenerateContentOptions): Promise<HiggsFieldJob> {
  const { data } = await client().post<HiggsFieldJob>('/generate', {
    workspaceId: config.higgsfield.workspaceId || undefined,
    prompt: options.prompt,
    quality: options.quality,
    format: options.format,
    duration: options.duration,
    optimize: options.optimize,
    settings: {
      codec: 'vp9',
      compression: 9,
      autoOptimize: true,
      lighting: options.lighting,
    },
  });
  return data;
}

export async function getJobStatus(jobId: string): Promise<HiggsFieldJob> {
  const { data } = await client().get<HiggsFieldJob>(`/jobs/${jobId}`);
  return data;
}

export async function listJobs(): Promise<HiggsFieldJob[]> {
  const { data } = await client().get<HiggsFieldJob[]>('/jobs');
  return data;
}

export async function deleteJob(jobId: string): Promise<void> {
  await client().delete(`/jobs/${jobId}`);
}

export async function downloadJobContentUrl(jobId: string): Promise<string> {
  const job = await getJobStatus(jobId);
  if (!job.result?.url) {
    throw new Error('El job todavía no tiene contenido generado.');
  }
  return job.result.url;
}
