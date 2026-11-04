import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { homeFor, useAuth } from '../context/AuthContext.jsx';
import { useCompany } from '../context/CompanyContext.jsx';
import { Button, ErrorNote, FullSpinner, Input } from '../components/ui.jsx';

// Fondo con la foto de la empresa y una capa oscura, como en la plantilla
export function AuthBackdrop({ children, footer = true }) {
  const c = useCompany();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <img src={c.loginBgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: 'rgba(24,52,56,0.44)' }} />
      <div className="relative flex w-full flex-col items-center">{children}</div>
      {footer && <p className="relative mt-10 text-[11px] text-white/90">© {new Date().getFullYear()} {c.developerName}</p>}
    </div>
  );
}

export function AuthLogo() {
  const c = useCompany();
  return (
    <div className="mb-5 rounded-xl bg-white/90 px-3 py-2 shadow-sm">
      <img src={c.logoUrl} alt={c.name} className="h-9 w-auto max-w-[200px] object-contain" />
    </div>
  );
}

export default function Login() {
  const { user, loading, login } = useAuth();
  const c = useCompany();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading || !c.ready) return <FullSpinner />;
  if (user) return <Navigate to={homeFor(user)} replace />;

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await login(identifier, password); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <AuthBackdrop>
      <AuthLogo />
      <form onSubmit={submit} className="anim-pop w-full max-w-[444px] rounded-[28px] bg-white px-7 py-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,.4)] sm:px-9 sm:py-9">
        <p className="text-[11px] font-semibold leading-[1.4] text-brand">{c.name}</p>
        <p className="mt-2 text-[14px] leading-[1.4] text-muted">{c.slogan}</p>
        <h1 className="mt-4 text-[28px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">Qué bueno verte.</h1>
        <div className="mt-6 space-y-[18px]">
          <Input label="Usuario" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus placeholder="Tu usuario o documento" />
          <Input label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
        </div>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <Button type="submit" icon={ArrowRight} loading={busy} className="mt-6 w-full py-3.5">Iniciar sesión</Button>
        <p className="mt-5 text-center text-[11.5px] text-muted">¿No tienes acceso? Contacta con el administrador del sistema.</p>
      </form>
      {c.loginText && <p className="mt-7 max-w-[440px] text-center text-[20px] leading-[1.45] text-white">{c.loginText}</p>}
    </AuthBackdrop>
  );
}
