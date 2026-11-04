import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, ErrorNote, Input, cx, useToast } from './ui.jsx';

export const rulesFor = (pw, current) => [
  { ok: pw.length >= 12, label: 'Al menos 12 caracteres' },
  { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: 'Una mayúscula y una minúscula' },
  { ok: /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw), label: 'Un número y un símbolo' },
  { ok: pw.length > 0 && pw !== current, label: 'Distinta de la contraseña actual' },
];

function strengthOf(pw) {
  const pts = [pw.length >= 12, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw), pw.length >= 16].filter(Boolean).length;
  if (!pw) return { pct: 0, label: '', cls: '' };
  if (pts <= 2) return { pct: 33, label: 'Seguridad baja', cls: 'bg-danger text-danger' };
  if (pts <= 4) return { pct: 66, label: 'Seguridad media', cls: 'bg-[#c9922b] text-warn' };
  return { pct: 100, label: 'Seguridad alta', cls: 'bg-ok text-ok' };
}

// Formulario "Cambiar contraseña" (modal, pantalla de primer ingreso y perfil)
export default function PasswordForm({ onDone, onCancel, title = 'Cambiar contraseña', intro, cancelLabel = 'Cancelar' }) {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const rules = useMemo(() => rulesFor(pw, cur), [pw, cur]);
  const st = strengthOf(pw);
  const match = pw2.length > 0 && pw === pw2;
  const valid = cur && rules.every((r) => r.ok) && match;

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setError('');
    try {
      await changePassword(cur, pw);
      toast.success('Contraseña actualizada');
      setCur(''); setPw(''); setPw2('');
      onDone?.();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2 className="text-[22px] font-semibold leading-[1.3] text-ink">{title}</h2>
      {intro && <p className="mt-2 text-[13px] leading-[1.5] text-muted">{intro}</p>}
      <div className="mt-5 space-y-[18px]">
        <Input label="Contraseña actual" required type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} autoFocus />
        <div>
          <Input label="Nueva contraseña" required type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <div className="mt-3" aria-live="polite">
            <div className="h-1 overflow-hidden rounded-full bg-line"><div className={cx('h-full rounded-full transition-all', st.cls.split(' ')[0])} style={{ width: `${st.pct}%` }} /></div>
            {st.label && <p className={cx('mt-2 text-[12px] font-semibold', st.cls.split(' ')[1])}>{st.label}</p>}
          </div>
        </div>
        <div>
          <Input label="Confirmar nueva contraseña" required type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          {pw2 && (
            <p className={cx('mt-2.5 flex items-center gap-1.5 text-[12px]', match ? 'text-ok' : 'text-danger')}>
              {match ? <><Check className="h-3.5 w-3.5" /> Las contraseñas coinciden</> : 'Las contraseñas no coinciden'}
            </p>
          )}
        </div>
      </div>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      <div className="mt-5 border-t border-line pt-5">
        <div className={cx('grid gap-3', onCancel ? 'sm:grid-cols-[auto_1fr]' : '')}>
          <Button type="submit" icon={Check} loading={busy} disabled={!valid} className="px-6 py-3.5">Actualizar contraseña</Button>
          {onCancel && <Button variant="secondary" onClick={onCancel} disabled={busy} className="py-3.5">{cancelLabel}</Button>}
        </div>
      </div>
      <div className="mx-auto mt-5 max-w-[330px] rounded-xl border border-line bg-tint px-6 py-5 text-[13px] leading-[1.5] text-ink">
        <p>Tu nueva contraseña debe cumplir estas condiciones:</p>
        <ul className="mt-3 space-y-2.5">
          {rules.map((r) => (
            <li key={r.label} className={cx('flex items-center gap-2', r.ok ? 'text-ok' : 'text-muted')}>
              <Check className={cx('h-3.5 w-3.5 shrink-0', !r.ok && 'opacity-40')} strokeWidth={2.2} />{r.label}
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}
