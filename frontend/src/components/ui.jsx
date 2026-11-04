import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, CircleAlert, CircleCheck, Loader2, X } from 'lucide-react';
import { api } from '../api/client.js';
import { initials } from '../lib/format.js';

export const cx = (...a) => a.filter(Boolean).join(' ');

/* ------------------------------ Botones ------------------------------ */
const BTN = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  secondary: 'bg-white text-brand border border-line hover:bg-tint',
  danger: 'bg-white text-danger border border-line hover:bg-red-50',
  ghost: 'text-brand hover:bg-tint',
};
const BTN_SIZE = { md: 'px-[18px] py-3 text-[14px]', sm: 'px-3.5 py-2 text-[13px]', xs: 'px-3 py-1.5 text-[12px]' };

export function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, className, children, disabled, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold leading-[1.45] whitespace-nowrap transition-colors disabled:opacity-50',
        BTN[variant], BTN_SIZE[size], className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={cx('animate-spin text-brand', className)} aria-label="Cargando" />;
}
export const FullSpinner = () => <div className="flex h-full min-h-[40vh] items-center justify-center"><Spinner className="h-7 w-7" /></div>;

/* ------------------------------ Campos ------------------------------ */
// Campo con la etiqueta pequeña flotando sobre el valor, como en las plantillas
function FieldShell({ label, required, hint, error, children, className, as: As = 'label' }) {
  return (
    <div className={className}>
      <As className={cx(
        'relative block rounded-lg border bg-white px-[13px] py-[11px] transition-colors focus-within:border-brand focus-within:ring-1 focus-within:ring-brand',
        error ? 'border-danger' : 'border-line',
      )}>
        {label && <span className="block text-[10px] font-semibold leading-[1.5] text-muted">{label}{required ? ' *' : ''}</span>}
        {children}
        {hint && <span className="mt-0.5 block text-[10px] leading-[1.4] text-muted">{hint}</span>}
      </As>
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}

const inputCls = 'block w-full bg-transparent text-[14px] leading-[1.5] text-ink outline-none placeholder:text-ink disabled:cursor-not-allowed disabled:text-muted read-only:cursor-default';

export function Input({ label, required, hint, error, className, inputClassName, ...props }) {
  return (
    <FieldShell label={label} required={required} hint={hint} error={error} className={className}>
      <input className={cx(inputCls, inputClassName)} {...props} />
    </FieldShell>
  );
}

export function Textarea({ label, required, hint, error, className, rows = 3, ...props }) {
  return (
    <FieldShell label={label} required={required} hint={hint} error={error} className={className}>
      <textarea rows={rows} className={cx(inputCls, 'resize-none')} {...props} />
    </FieldShell>
  );
}

export function Select({ label, required, hint, error, className, children, ...props }) {
  return (
    <FieldShell label={label} required={required} hint={hint} error={error} className={className}>
      <select className={cx(inputCls, 'cursor-pointer pr-6')} {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" style={{ marginTop: label ? 4 : 0 }} />
    </FieldShell>
  );
}

export function Checkbox({ checked, onChange, children, disabled, className }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-2.5 text-[13px] text-ink', disabled && 'cursor-not-allowed opacity-60', className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-brand text-white peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </label>
  );
}

/* ------------------------------ Contenedores ------------------------------ */
export const Card = ({ className, tint, children, ...p }) => (
  <div className={cx('rounded-[14px] border border-line', tint ? 'bg-tint' : 'bg-white', className)} {...p}>{children}</div>
);

export const Chip = ({ children, className, tone = 'tint' }) => (
  <span className={cx(
    'inline-flex items-center rounded-full px-2.5 py-[5px] text-[11px] font-semibold leading-[1.45]',
    tone === 'ok' ? 'bg-ok-bg text-ok' : tone === 'muted' ? 'bg-page text-muted' : 'bg-tint text-brand', className,
  )}>{children}</span>
);

export function PageHeader({ eyebrow, title, subtitle, action, className }) {
  return (
    <div className={cx('mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-[10px] font-semibold uppercase leading-[1.6] text-brand">{eyebrow}</p>}
        <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[38px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] leading-[1.5] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export const EmptyState = ({ title, children }) => (
  <div className="rounded-[14px] border border-dashed border-line bg-white/60 px-6 py-10 text-center">
    <p className="text-[15px] font-semibold text-ink">{title}</p>
    {children && <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">{children}</p>}
  </div>
);

export const ErrorNote = ({ children }) => (
  <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] text-danger">
    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{children}
  </p>
);

/* ------------------------------ Avatar (con sesión) ------------------------------ */
// Las fotos requieren el token, por eso se bajan como blob y se guardan en caché por id de archivo
const avatarCache = new Map();
function loadBlobUrl(fileId) {
  if (!avatarCache.has(fileId)) {
    avatarCache.set(fileId, api.blob(`/files/${fileId}/preview`).then(({ blob }) => URL.createObjectURL(blob)).catch(() => { avatarCache.delete(fileId); return null; }));
  }
  return avatarCache.get(fileId);
}
export function useBlobUrl(fileId) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (fileId) loadBlobUrl(fileId).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [fileId]);
  return url;
}

export function Avatar({ fileId, name = '', size = 40, className, dark }) {
  const url = useBlobUrl(fileId);
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };
  if (url) return <img src={url} alt="" style={style} className={cx('shrink-0 rounded-full object-cover', className)} />;
  return (
    <span style={style} aria-hidden="true"
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', dark ? 'bg-ink text-white' : 'bg-tint text-brand', className)}>
      {dark ? '' : initials(name)}
    </span>
  );
}

// Imagen protegida (portadas de publicaciones)
export function AuthImage({ fileId, alt = '', className }) {
  const url = useBlobUrl(fileId);
  if (!url) return <div className={cx('animate-pulse bg-tint', className)} />;
  return <img src={url} alt={alt} className={cx('object-cover', className)} />;
}

/* ------------------------------ Modal ------------------------------ */
export function Modal({ open, onClose, title, width = 600, children, panel = false, closeOnBackdrop = true, className }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={cx('fixed inset-0 z-50 flex anim-fade', panel ? 'items-end justify-end sm:p-6' : 'items-end justify-center sm:items-center sm:p-6')}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" onClick={closeOnBackdrop ? onClose : undefined} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title}
        style={{ '--w': `${width}px` }}
        className={cx(
          'anim-sheet relative flex max-h-[94dvh] w-full flex-col overflow-hidden bg-white shadow-[0_30px_80px_-20px_rgba(32,51,56,.35)] sm:w-[var(--w)] sm:max-w-full sm:rounded-[24px]',
          'rounded-t-[24px]', panel && 'sm:h-[min(740px,calc(100dvh-48px))]', className,
        )}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, subtitle, onClose, id }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pb-0 pt-6 sm:px-8 sm:pt-8">
      <div className="min-w-0">
        <h2 id={id} className="text-[24px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink sm:text-[28px]">{title}</h2>
        {subtitle && <p className="mt-3 text-[13px] leading-[1.5] text-muted">{subtitle}</p>}
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-1 rounded-lg p-1.5 text-brand hover:bg-tint"><X className="h-5 w-5" strokeWidth={1.5} /></button>
    </div>
  );
}

/* ------------------------------ Zona de carga de archivos ------------------------------ */
export function Dropzone({ title, hint, accept, file, onFile, error, inputRef }) {
  const local = useRef(null);
  const ref = inputRef || local;
  const [drag, setDrag] = useState(false);
  const pick = (f) => f && onFile(f);
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        className={cx('flex flex-col items-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
          drag ? 'border-brand bg-tint' : 'border-line bg-page', error && 'border-danger')}
      >
        <UploadGlyph />
        <p className="mt-3 text-[14px] font-semibold text-ink">{file ? file.name : title}</p>
        <p className="mt-2 text-[11px] text-muted">{file ? `${(file.size / 1024 / 1024).toFixed(2).replace('.', ',')} MB` : hint}</p>
        <input ref={ref} type="file" accept={accept} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => ref.current?.click()}>{file ? 'Cambiar archivo' : 'Seleccionar archivo'}</Button>
      </div>
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
const UploadGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6 text-brand" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15V4M8 8l4-4 4 4M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" />
  </svg>
);

/* ------------------------------ Avisos (toasts) ------------------------------ */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  const value = useMemo(() => ({ success: (m) => push(m, 'success'), error: (m) => push(m, 'error') }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className="anim-pop pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-ink shadow-lg">
            {t.type === 'error' ? <CircleAlert className="h-4 w-4 shrink-0 text-danger" /> : <CircleCheck className="h-4 w-4 shrink-0 text-ok" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------ Confirmación ------------------------------ */
export function ConfirmModal({ open, title, message, confirmLabel = 'Confirmar', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (!open) setErr(''); }, [open]);
  return (
    <Modal open={open} onClose={busy ? undefined : onClose} width={440}>
      <div className="p-6 sm:p-8">
        <h2 className="text-[20px] font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-[14px] leading-[1.5] text-muted">{message}</p>
        {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
        <div className="mt-6 flex gap-3">
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); setErr(''); try { await onConfirm(); } catch (e) { setErr(e.message); } finally { setBusy(false); } }}>{confirmLabel}</Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}
