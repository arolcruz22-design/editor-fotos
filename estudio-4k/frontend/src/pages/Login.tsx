import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { login, register, loading, error } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, fullName);
      }
      navigate('/');
    } catch {
      // el mensaje de error ya queda expuesto vía useAuth().error
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-studio-panel border border-studio-border rounded-xl p-6 space-y-4">
        <div className="text-center space-y-1 mb-2">
          <div className="text-2xl">🎬</div>
          <h1 className="text-lg font-bold">Estudio 4K Profesional</h1>
          <p className="text-xs text-slate-400">Todomotos S.A. de C.V.</p>
        </div>

        {mode === 'register' && (
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nombre completo"
            required
            className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo"
          required
          className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          required
          minLength={8}
          className="w-full bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-sm"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-studio-accent text-black font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? 'Un momento…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="w-full text-xs text-studio-accent2 hover:underline"
        >
          {mode === 'login' ? '¿Primera vez? Crea tu cuenta del equipo' : 'Ya tengo cuenta, iniciar sesión'}
        </button>
      </form>
    </div>
  );
}
