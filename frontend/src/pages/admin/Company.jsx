import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, RotateCcw } from 'lucide-react';
import { api } from '../../api/client.js';
import { useCompany } from '../../context/CompanyContext.jsx';
import { Button, Card, ErrorNote, Input, PageHeader, cx, useToast } from '../../components/ui.jsx';

const HEX = /^#[0-9a-fA-F]{6}$/;

function ColorField({ label, value, onChange }) {
  return (
    <div className="rounded-lg border border-line bg-white px-[13px] py-[11px] focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
      <span className="block text-[10px] font-semibold leading-[1.5] text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <input type="color" value={HEX.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-7 w-9 cursor-pointer rounded border border-line bg-white p-0.5" />
        <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={7} spellCheck="false" aria-label={`${label} (hexadecimal)`} className="w-full bg-transparent text-[14px] uppercase text-ink outline-none" />
      </div>
    </div>
  );
}

function ImagePicker({ title, hint, current, onFile, onReset, picked, dark }) {
  const input = useRef(null);
  return (
    <div>
      <p className="mb-3 text-[13px] font-semibold text-ink">{title}</p>
      <div className={cx('flex h-[170px] items-center justify-center overflow-hidden rounded-xl border border-line', dark ? 'bg-page' : 'bg-white')}>
        <img src={picked?.preview || current} alt="" className={dark ? 'h-full w-full object-cover' : 'max-h-[90px] max-w-[80%] object-contain'} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => input.current?.click()}>Cambiar imagen</Button>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset}>Usar la original</Button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <p className="mt-2 text-[11px] text-muted">{hint}</p>
    </div>
  );
}

export default function Company() {
  const c = useCompany();
  const toast = useToast();
  const [f, setF] = useState({ name: c.name, slogan: c.slogan, primaryColor: c.primaryColor, accentColor: c.accentColor });
  const [logo, setLogo] = useState(null);       // { file, preview } | { remove: true }
  const [bg, setBg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setF({ name: c.name, slogan: c.slogan, primaryColor: c.primaryColor, accentColor: c.accentColor }); }, [c.name, c.slogan, c.primaryColor, c.accentColor]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const pick = (set, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('La imagen puede pesar máximo 10 MB');
    set({ file, preview: URL.createObjectURL(file) });
  };

  async function save(e) {
    e.preventDefault();
    if (!f.name.trim()) return setError('El nombre de la empresa es obligatorio');
    if (!HEX.test(f.primaryColor) || !HEX.test(f.accentColor)) return setError('Los colores deben tener formato #RRGGBB');
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('name', f.name); fd.append('slogan', f.slogan);
      fd.append('primaryColor', f.primaryColor); fd.append('accentColor', f.accentColor);
      if (logo?.file) fd.append('logo', logo.file); else if (logo?.remove) fd.append('removeLogo', 'true');
      if (bg?.file) fd.append('loginBg', bg.file); else if (bg?.remove) fd.append('removeLoginBg', 'true');
      const res = await fetch('/api/company', { method: 'PUT', headers: { Authorization: `Bearer ${localStorage.getItem('plataforma.token')}` }, body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      await c.reload();
      setLogo(null); setBg(null);
      toast.success('Los datos de la empresa se guardaron');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="max-w-[1112px]">
      <PageHeader eyebrow="Administración / Empresa" title="Empresa" subtitle="La identidad que verá todo el equipo al iniciar sesión y en el menú." />
      <form onSubmit={save} className="space-y-6">
        <Card className="p-6">
          <h2 className="mb-5 text-[20px] font-semibold text-ink">Identidad</h2>
          <div className="grid gap-3.5 md:grid-cols-2">
            <Input label="Nombre de la empresa" required value={f.name} onChange={set('name')} maxLength={120} />
            <Input label="Eslogan" value={f.slogan} onChange={set('slogan')} maxLength={200} />
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-5 text-[20px] font-semibold text-ink">Imágenes</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <ImagePicker title="Logo" hint="PNG, SVG o JPG con fondo transparente o blanco · Máximo 10 MB."
              current={logo?.remove ? '/img/logo.svg' : c.logoUrl} picked={logo?.file ? logo : null}
              onFile={(file) => pick(setLogo, file)} onReset={() => setLogo({ remove: true })} />
            <ImagePicker title="Foto organizacional (inicio de sesión)" hint="JPG o PNG · Recomendado: 1440 × 1000 px · Máximo 10 MB." dark
              current={bg?.remove ? '/img/login-bg.jpg' : c.loginBgUrl} picked={bg?.file ? bg : null}
              onFile={(file) => pick(setBg, file)} onReset={() => setBg({ remove: true })} />
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-5 text-[20px] font-semibold text-ink">Colores institucionales</h2>
          <div className="grid gap-3.5 md:grid-cols-2">
            <ColorField label="Color principal (botones y acentos)" value={f.primaryColor} onChange={(v) => setF((s) => ({ ...s, primaryColor: v }))} />
            <ColorField label="Color de acento (fondos suaves)" value={f.accentColor} onChange={(v) => setF((s) => ({ ...s, accentColor: v }))} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-line p-4">
            <span className="text-[11px] text-muted">Vista previa</span>
            <span className="rounded-lg px-[18px] py-3 text-[14px] font-semibold text-white" style={{ background: HEX.test(f.primaryColor) ? f.primaryColor : '#184f5b' }}>Botón principal</span>
            <span className="rounded-full px-2.5 py-[5px] text-[11px] font-semibold" style={{ background: HEX.test(f.accentColor) ? f.accentColor : '#e8f0f0', color: HEX.test(f.primaryColor) ? f.primaryColor : '#184f5b' }}>Etiqueta</span>
          </div>
        </Card>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" icon={Check} loading={busy}>Guardar cambios</Button>
      </form>
    </div>
  );
}
