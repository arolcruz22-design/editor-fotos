import { useState } from 'react';
import type { LightingSettings } from '../types';

const DEFAULT_SETTINGS: LightingSettings = {
  red: 255,
  green: 244,
  blue: 214,
  colorTemperatureK: 5600,
  intensityPercent: 80,
};

interface Props {
  value?: LightingSettings;
  onChange?: (settings: LightingSettings) => void;
}

// Control de iluminación del estudio: sliders RGB, temperatura de color e
// intensidad. El resultado se envía como contexto al generar contenido con
// Higgsfield (ver HiggsFieldPanel).
export function LightingControl({ value, onChange }: Props) {
  const [settings, setSettings] = useState<LightingSettings>(value ?? DEFAULT_SETTINGS);

  const update = (patch: Partial<LightingSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    onChange?.(next);
  };

  const swatch = `rgb(${settings.red}, ${settings.green}, ${settings.blue})`;

  return (
    <div className="bg-studio-panel border border-studio-border rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Control de iluminación</h3>
        <div className="w-10 h-10 rounded-full border border-studio-border" style={{ background: swatch }} />
      </div>

      {(['red', 'green', 'blue'] as const).map((channel) => (
        <label key={channel} className="block text-sm">
          <span className="capitalize text-slate-400">
            {{ red: 'Rojo', green: 'Verde', blue: 'Azul' }[channel]}: {settings[channel]}
          </span>
          <input
            type="range"
            min={0}
            max={255}
            value={settings[channel]}
            onChange={(e) => update({ [channel]: Number(e.target.value) } as Partial<LightingSettings>)}
            className="w-full accent-studio-accent"
          />
        </label>
      ))}

      <label className="block text-sm">
        <span className="text-slate-400">Temperatura de color: {settings.colorTemperatureK}K</span>
        <input
          type="range"
          min={2000}
          max={10000}
          step={100}
          value={settings.colorTemperatureK}
          onChange={(e) => update({ colorTemperatureK: Number(e.target.value) })}
          className="w-full accent-studio-accent2"
        />
      </label>

      <label className="block text-sm">
        <span className="text-slate-400">Intensidad: {settings.intensityPercent}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.intensityPercent}
          onChange={(e) => update({ intensityPercent: Number(e.target.value) })}
          className="w-full accent-studio-accent"
        />
      </label>
    </div>
  );
}
