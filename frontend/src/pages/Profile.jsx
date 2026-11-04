import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Lock } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCompany } from '../context/CompanyContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { invalidateDirectory } from '../hooks/useDirectory.js';
import { Avatar, Button, Card, Chip, ErrorNote, FullSpinner, Input, PageHeader, useToast } from '../components/ui.jsx';
import PasswordModal from '../modals/PasswordModal.jsx';
import { PERM_LABEL, formatLongDate } from '../lib/format.js';

const LEVEL = { colaborador: 'Colaborador', lider: 'Líder', responsable: 'Responsable', administrador: 'Administrador' };

export default function Profile() {
  const { user, refresh } = useAuth();
  const company = useCompany();
  const toast = useToast();
  const { data: me, loading, setData } = useApi('/users/me');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    if (me) setForm({ emergency_name: me.emergency_name || '', emergency_phone: me.emergency_phone || '', personal_email: me.personal_email || '', personal_phone: me.personal_phone || '' });
  }, [me]);

  if (loading || !me || !form) return <FullSpinner />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = Object.keys(form).some((k) => form[k] !== (me[k] || ''));

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try { setData(await api.put('/users/me', form)); toast.success('Datos de contacto guardados'); } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function changePhoto(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('La foto puede pesar máximo 5 MB');
    setPhotoBusy(true);
    try {
      const fd = new FormData(); fd.append('context', 'avatar'); fd.append('files', file);
      await api.upload('/files', fd);
      await refresh(); invalidateDirectory();
      setData(await api.get('/users/me'));
      toast.success('Foto actualizada');
    } catch (err) { toast.error(err.message); } finally { setPhotoBusy(false); }
  }

  return (
    <div className="max-w-[1112px]">
      <PageHeader eyebrow={`${company.name} / Perfil`} title="Mi perfil" subtitle="Tu identidad, tus datos y tus permisos." />
      <div className="grid items-start gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="px-6 pb-6 pt-6">
            <h2 className="text-[20px] font-semibold text-ink">Foto de perfil</h2>
            <div className="mt-5 flex flex-col items-center">
              <Avatar fileId={me.photo_file_id} name={me.name} size={112} />
              <p className="mt-5 text-[20px] font-semibold text-ink">{me.username}</p>
              {me.position_name && <Chip className="mt-3">{me.position_name}</Chip>}
            </div>
            <Button variant="secondary" icon={Camera} loading={photoBusy} onClick={() => input.current?.click()} className="mt-5 w-full">Cambiar foto</Button>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { changePhoto(e.target.files?.[0]); e.target.value = ''; }} />
            <p className="mt-4 text-center text-[11px] text-muted">Sube una foto JPG o PNG · Máximo 5 MB</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-[20px] font-semibold text-ink">Datos personales</h2>
            <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
              <Input label="Nombre completo" value={me.name} readOnly />
              <Input label="Correo corporativo" value={me.email || '—'} readOnly />
              <Input label="Área a la que perteneces" value={me.area_name || '—'} readOnly />
              <Input label="Cargo" value={me.position_name || '—'} readOnly />
            </div>
            <div className="my-5 border-t border-line" />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input label="Fecha de nacimiento" value={formatLongDate(me.birth_date)} readOnly />
              <Input label="Fecha de ingreso" value={formatLongDate(me.hire_date)} readOnly />
            </div>
            <p className="mt-4 text-[11px] text-muted">Si algún dato no es correcto, solicita el cambio al administrador.</p>
          </Card>

          <Card className="p-6">
            <form onSubmit={save}>
              <h2 className="text-[20px] font-semibold text-ink">Datos de contacto</h2>
              <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
                <Input label="Nombre contacto de emergencia" value={form.emergency_name} onChange={set('emergency_name')} maxLength={120} placeholder="Nombre contacto" />
                <Input label="Teléfono de contacto" type="tel" value={form.emergency_phone} onChange={set('emergency_phone')} maxLength={30} placeholder="Ej. 3107654321" />
                <Input label="Correo personal" type="email" value={form.personal_email} onChange={set('personal_email')} maxLength={160} placeholder="micorreo@example.com" />
                <Input label="Teléfono personal" type="tel" value={form.personal_phone} onChange={set('personal_phone')} maxLength={30} placeholder="Ej. 3211234567" />
              </div>
              {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
              <div className="mt-5 border-t border-line pt-5">
                <Button type="submit" icon={Check} loading={saving} disabled={!dirty}>Guardar cambios</Button>
              </div>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="text-[20px] font-semibold text-ink">Tus permisos</h2>
            <Chip className="mt-4">{LEVEL[me.level] || me.level}</Chip>
            <ul className="mt-4 space-y-3">
              {me.permissions.map((p) => (
                <li key={p} className="flex items-center gap-2 text-[13px] text-ink"><Check className="h-3.5 w-3.5 text-ok" strokeWidth={2.2} />{PERM_LABEL[p]}</li>
              ))}
              {me.permissions.length === 0 && <li className="text-[13px] text-muted">Sin permisos asignados.</li>}
            </ul>
            <div className="mt-5 border-t border-line pt-5">
              <Button variant="secondary" icon={Lock} onClick={() => setPwOpen(true)}>Cambiar contraseña</Button>
            </div>
          </Card>
        </div>
      </div>
      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
    </div>
  );
}
