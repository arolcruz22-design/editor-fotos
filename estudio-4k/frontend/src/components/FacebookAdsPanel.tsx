import { useState } from 'react';
import { useAccounts } from '../hooks/useAccounts';
import { useFacebookAds } from '../hooks/useFacebookAds';
import { AccountSwitcher } from './AccountSwitcher';
import { ConnectAccountModal } from './ConnectAccountModal';

const OBJECTIVES = ['REACH', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_SALES', 'OUTCOME_LEADS'] as const;

export function FacebookAdsPanel() {
  const { selectedAccountId, accounts } = useAccounts();
  const { campaigns, loading, error, createCampaign, pauseCampaign, activateCampaign } =
    useFacebookAds(selectedAccountId);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<(typeof OBJECTIVES)[number]>('OUTCOME_TRAFFIC');
  const [dailyBudget, setDailyBudget] = useState(200);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createCampaign({ name, objective, dailyBudgetCents: Math.round(dailyBudget * 100) });
    setName('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <AccountSwitcher />
        <button
          onClick={() => setModalOpen(true)}
          className="text-sm bg-studio-accent2 text-black font-medium px-3 py-2 rounded-lg"
        >
          + Conectar otra cuenta
        </button>
      </div>

      {accounts.length === 0 && (
        <p className="text-sm text-slate-400">
          Conecta al menos una cuenta de Facebook Ads para crear campañas y publicar creatives.
        </p>
      )}

      {selectedAccountId && (
        <div className="bg-studio-panel border border-studio-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Nueva campaña</h3>
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la campaña"
              required
              className="bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value as (typeof OBJECTIVES)[number])}
              className="bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm"
            >
              {OBJECTIVES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              step="0.01"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(Number(e.target.value))}
              className="bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="sm:col-span-2 bg-studio-accent text-black font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? 'Creando…' : 'Crear campaña (queda en pausa)'}
            </button>
          </form>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div>
            <h4 className="text-xs uppercase text-slate-500 mb-2">Campañas</h4>
            <ul className="space-y-2">
              {campaigns.length === 0 && <li className="text-sm text-slate-500">Sin campañas todavía.</li>}
              {campaigns.map((c) => (
                <li key={c.id} className="flex items-center justify-between bg-studio-bg rounded-lg px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.objective}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        c.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'
                      }`}
                    >
                      {c.status}
                    </span>
                    {c.status === 'ACTIVE' ? (
                      <button onClick={() => pauseCampaign(c.id)} className="text-xs text-studio-accent2 hover:underline">
                        Pausar
                      </button>
                    ) : (
                      <button onClick={() => activateCampaign(c.id)} className="text-xs text-studio-accent2 hover:underline">
                        Activar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <ConnectAccountModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
