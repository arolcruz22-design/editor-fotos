import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { LightingControl } from '../components/LightingControl';
import { HiggsFieldPanel } from '../components/HiggsFieldPanel';
import { FacebookAdsPanel } from '../components/FacebookAdsPanel';
import { AccountsManager } from '../components/AccountsManager';
import { useAccounts } from '../hooks/useAccounts';
import type { LightingSettings } from '../types';

function Overview() {
  const { accounts } = useAccounts();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="bg-studio-panel border border-studio-border rounded-xl p-5">
        <div className="text-xs text-slate-500">Cuentas de Facebook conectadas</div>
        <div className="text-3xl font-bold mt-1">{accounts.length}</div>
      </div>
      <div className="bg-studio-panel border border-studio-border rounded-xl p-5 sm:col-span-2">
        <div className="text-xs text-slate-500 mb-2">Todo desde un solo lugar</div>
        <p className="text-sm text-slate-300">
          Ajusta la iluminación, genera contenido 4K con Higgsfield.ai y publícalo directo en cualquiera de tus
          cuentas de Facebook Ads — sin salir de este panel.
        </p>
      </div>
    </div>
  );
}

function ContentStudio() {
  const [lighting, setLighting] = useState<LightingSettings | undefined>();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LightingControl onChange={setLighting} />
      <HiggsFieldPanel lighting={lighting} />
    </div>
  );
}

export function Dashboard() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="lighting" element={<div className="max-w-md"><LightingControl /></div>} />
          <Route path="content" element={<ContentStudio />} />
          <Route path="ads" element={<FacebookAdsPanel />} />
          <Route path="accounts" element={<AccountsManager />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
