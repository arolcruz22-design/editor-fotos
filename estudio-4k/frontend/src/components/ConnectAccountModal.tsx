import { useState } from 'react';
import { useAccounts } from '../hooks/useAccounts';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Flujo para conectar una nueva cuenta publicitaria de Facebook: el usuario
// pega un access token (de un System User de Meta Business, recomendado para
// producción) y elegimos de qué cuenta publicitaria se trata.
export function ConnectAccountModal({ open, onClose }: Props) {
  const { discover, connect } = useAccounts();
  const [accessToken, setAccessToken] = useState('');
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string; currency: string }>>([]);
  const [label, setLabel] = useState('');
  const [selectedAdAccount, setSelectedAdAccount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleDiscover = async () => {
    setError(null);
    setBusy(true);
    try {
      const found = await discover(accessToken);
      setCandidates(found);
      setSelectedAdAccount(found[0]?.id ?? '');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'No se pudo validar ese token con Meta.');
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async () => {
    setError(null);
    setBusy(true);
    try {
      await connect({ label: label || selectedAdAccount, adAccountId: selectedAdAccount, accessToken });
      onClose();
      setAccessToken('');
      setCandidates([]);
      setLabel('');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'No se pudo conectar la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-studio-panel border border-studio-border rounded-xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-semibold text-lg">Conectar cuenta de Facebook Ads</h3>
        <p className="text-xs text-slate-400">
          Pega un access token de larga duración (idealmente de un System User de Meta Business Manager) con permisos
          <code className="mx-1 text-studio-accent2">ads_management</code>.
        </p>

        <textarea
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          rows={3}
          placeholder="EAAxxxxxxxxxxxxxxxxxxxxxx"
          className="w-full bg-studio-bg border border-studio-border rounded-lg p-3 text-sm font-mono"
        />

        <button
          onClick={handleDiscover}
          disabled={!accessToken || busy}
          className="text-sm bg-studio-accent2 text-black font-medium px-3 py-2 rounded-lg disabled:opacity-50"
        >
          Buscar cuentas publicitarias
        </button>

        {candidates.length > 0 && (
          <>
            <select
              value={selectedAdAccount}
              onChange={(e) => setSelectedAdAccount(e.target.value)}
              className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id}) · {c.currency}
                </option>
              ))}
            </select>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nombre para mostrar (ej. Todomotos Medina)"
              className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm"
            />
          </>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-sm px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5">
            Cancelar
          </button>
          <button
            onClick={handleConnect}
            disabled={!selectedAdAccount || busy}
            className="text-sm bg-studio-accent text-black font-medium px-4 py-2 rounded-lg disabled:opacity-50"
          >
            Conectar cuenta
          </button>
        </div>
      </div>
    </div>
  );
}
