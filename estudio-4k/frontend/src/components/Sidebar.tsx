import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const links = [
  { to: '/', label: 'Panel general', icon: '◉' },
  { to: '/lighting', label: 'Control de focos', icon: '◧' },
  { to: '/content', label: 'Generar contenido 4K', icon: '🎬' },
  { to: '/ads', label: 'Facebook Ads', icon: '📊' },
  { to: '/accounts', label: 'Cuentas conectadas', icon: '🔗' },
];

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 shrink-0 bg-studio-panel border-r border-studio-border flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-studio-border">
        <div className="text-lg font-bold tracking-tight">🎬 Estudio 4K</div>
        <div className="text-xs text-slate-400">Todomotos S.A. de C.V.</div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-studio-accent/15 text-studio-accent' : 'text-slate-300 hover:bg-white/5'
              }`
            }
          >
            <span>{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-studio-border space-y-2">
        <a
          href="../../centro-trabajo.html"
          className="block px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/5"
        >
          ← Volver al Centro de Trabajo
        </a>
        {user && (
          <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400">
            <span className="truncate">{user.full_name}</span>
            <button onClick={logout} className="text-studio-accent2 hover:underline">
              Salir
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
