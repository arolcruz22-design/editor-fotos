// hooks/useHiggsfield.ts
// Adaptado del hook original del blueprint para llamar al backend propio
// (estudio-4k/backend), que a su vez habla con la API real de Higgsfield.ai.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { GenerateOptions, HiggsFieldJob } from '../types';

interface UseHiggsFieldReturn {
  jobs: HiggsFieldJob[];
  currentJob: HiggsFieldJob | null;
  loading: boolean;
  error: string | null;
  generateContent: (options: GenerateOptions) => Promise<HiggsFieldJob>;
  fetchJobStatus: (jobId: string) => Promise<HiggsFieldJob>;
  getAllJobs: () => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  downloadContent: (jobId: string) => Promise<string>;
}

export const useHiggsfield = (): UseHiggsFieldReturn => {
  const [jobs, setJobs] = useState<HiggsFieldJob[]>([]);
  const [currentJob, setCurrentJob] = useState<HiggsFieldJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const fetchJobStatus = useCallback(async (jobId: string): Promise<HiggsFieldJob> => {
    const { data } = await api.get(`/higgsfield/jobs/${jobId}`);
    return data as HiggsFieldJob;
  }, []);

  const pollJobStatus = useCallback(
    (jobId: string) => {
      if (pollTimers.current[jobId]) return;
      pollTimers.current[jobId] = setInterval(async () => {
        try {
          const job = await fetchJobStatus(jobId);
          setJobs((prev) => prev.map((j) => (j.id === jobId ? job : j)));
          setCurrentJob((prev) => (prev?.id === jobId ? job : prev));
          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollTimers.current[jobId]);
            delete pollTimers.current[jobId];
          }
        } catch (err) {
          console.error('Error consultando estado del job:', err);
        }
      }, 3000);
    },
    [fetchJobStatus]
  );

  const generateContent = useCallback(
    async (options: GenerateOptions): Promise<HiggsFieldJob> => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post('/higgsfield/generate', options);
        const newJob = data as HiggsFieldJob;
        setCurrentJob(newJob);
        setJobs((prev) => [newJob, ...prev]);
        pollJobStatus(newJob.id);
        return newJob;
      } catch (err: any) {
        const message = err.response?.data?.error ?? 'Error generando contenido.';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [pollJobStatus]
  );

  const getAllJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/higgsfield/jobs');
      setJobs(data);
    } catch {
      setError('Error obteniendo el historial de generaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteJob = useCallback(async (jobId: string) => {
    await api.delete(`/higgsfield/jobs/${jobId}`);
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    setCurrentJob((prev) => (prev?.id === jobId ? null : prev));
  }, []);

  const downloadContent = useCallback(async (jobId: string): Promise<string> => {
    const { data } = await api.get(`/higgsfield/jobs/${jobId}/download`);
    return data.url as string;
  }, []);

  useEffect(() => {
    getAllJobs();
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { jobs, currentJob, loading, error, generateContent, fetchJobStatus, getAllJobs, deleteJob, downloadContent };
};
