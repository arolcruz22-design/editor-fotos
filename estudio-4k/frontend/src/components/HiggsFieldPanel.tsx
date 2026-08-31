import { useState } from 'react';
import { useHiggsfield } from '../hooks/useHiggsfield';
import type { LightingSettings } from '../types';

interface Props {
  lighting?: LightingSettings;
}

export function HiggsFieldPanel({ lighting }: Props) {
  const { jobs, loading, error, generateContent } = useHiggsfield();
  const [prompt, setPrompt] = useState('Producto de motocicleta bajo luz de estudio profesional, fondo neutro');
  const [format, setFormat] = useState<'webp' | 'mp4'>('webp');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    await generateContent({ prompt, quality: '4k', format, optimize: true, lighting });
  };

  return (
    <div className="bg-studio-panel border border-studio-border rounded-xl p-5 space-y-4">
      <h3 className="font-semibold">Generar contenido 4K (Higgsfield.ai)</h3>

      <form onSubmit={handleGenerate} className="space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full bg-studio-bg border border-studio-border rounded-lg p-3 text-sm"
          placeholder="Describe el contenido a generar..."
        />
        <div className="flex items-center gap-3">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as 'webp' | 'mp4')}
            className="bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm"
          >
            <option value="webp">Imagen WebP</option>
            <option value="mp4">Video MP4 (VP9 optimizado)</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="ml-auto bg-studio-accent text-black font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? 'Generando…' : 'Generar en 4K'}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div>
        <h4 className="text-xs uppercase text-slate-500 mb-2">Historial de generaciones</h4>
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {jobs.length === 0 && <li className="text-sm text-slate-500">Todavía no has generado contenido.</li>}
          {jobs.map((job) => (
            <li key={job.id} className="flex items-center justify-between text-sm bg-studio-bg rounded-lg px-3 py-2">
              <span className="truncate">{job.id}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  job.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : job.status === 'failed'
                      ? 'bg-red-500/15 text-red-400'
                      : 'bg-studio-accent2/15 text-studio-accent2'
                }`}
              >
                {job.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
