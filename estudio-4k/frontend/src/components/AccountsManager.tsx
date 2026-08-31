import { useState } from 'react';
import { useAccounts } from '../hooks/useAccounts';
import { ConnectAccountModal } from './ConnectAccountModal';

export function AccountsManager() {
  const { accounts, disconnect } = useAccounts();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="bg-studio-panel border border-studio-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Cuentas de Facebook Ads conectadas</h3>
        <button
          onClick={() => setModalOpen(true)}
          className="text-sm bg-studio-accent text-black font-medium px-3 py-2 rounded-lg"
        >
          + Conectar cuenta
        </button>
      </div>

      <ul className="space-y-2">
        {accounts.length === 0 && (
          <li className="text-sm text-slate-500">
            Todavía no hay cuentas conectadas. Puedes tener una por cada tienda o marca de Todomotos.
          </li>
        )}
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center justify-between bg-studio-bg rounded-lg px-3 py-3 text-sm">
            <div>
              <div className="font-medium">{a.label}</div>
              <div className="text-xs text-slate-500">
                {a.adAccountId} · {a.currency} · {a.timezone}
              </div>
            </div>
            <button onClick={() => disconnect(a.id)} className="text-xs text-red-400 hover:underline">
              Desconectar
            </button>
          </li>
        ))}
      </ul>

      <ConnectAccountModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
