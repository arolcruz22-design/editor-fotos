import { useAccounts } from '../hooks/useAccounts';

// Selector de cuenta publicitaria activa: permite cambiar entre las distintas
// cuentas de Facebook conectadas sin salir del dashboard.
export function AccountSwitcher() {
  const { accounts, selectedAccountId, selectAccount } = useAccounts();

  if (accounts.length === 0) {
    return <span className="text-sm text-slate-500">Sin cuentas de Facebook conectadas todavía.</span>;
  }

  return (
    <select
      value={selectedAccountId ?? ''}
      onChange={(e) => selectAccount(e.target.value)}
      className="bg-studio-panel border border-studio-border rounded-lg px-3 py-2 text-sm"
    >
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.label} · {a.adAccountId}
        </option>
      ))}
    </select>
  );
}
