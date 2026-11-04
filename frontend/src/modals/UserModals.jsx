import { useMemo, useState } from 'react';
import { UserPlus, Check } from 'lucide-react';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { invalidateDirectory } from '../hooks/useDirectory.js';
import { Avatar, Button, Checkbox, ConfirmModal, Dropzone, ErrorNote, Input, Modal, Select, cx, useToast } from '../components/ui.jsx';
import { LEVELS, LEVEL_PERMS, PERM_LABEL } from '../lib/format.js';

const EMPTY = { first_name: '', second_name: '', last_name: '', second_last_name: '', document: '', phone: '', hire_date: '', birth_date: '', area_id: '', position_id: '', email: '' };

/* ---------------------------- Crear / editar persona ---------------------------- */
export function UserFormModal({ user, onClose }) {
  const toast = useToast();
  const edit = !!user;
  const { data: areas } = useApi('/areas');
  const { data: positions } = useApi('/positions');
  const [f, setF] = useState(() => (user ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, user[k] ?? ''])) : EMPTY));
  const [photo, setPhoto] = useState(null);
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value, ...(k === 'area_id' ? { position_id: '' } : {}) }));
  const areaPositions = useMemo(() => (positions || []).filter((p) => String(p.area_id) === String(f.area_id)), [positions, f.area_id]);

  async function submit(e) {
    e.preventDefault();
    const er = {};
    for (const [k, msg] of [['first_name', 'Obligatorio'], ['last_name', 'Obligatorio'], ['document', 'Obligatorio'], ['phone', 'Obligatorio'], ['hire_date', 'Obligatorio'], ['birth_date', 'Obligatorio'], ['area_id', 'Selecciona el área'], ['position_id', 'Selecciona el cargo']]) {
      if (!String(f[k]).trim()) er[k] = msg;
    }
    if (photo && photo.size > 5 * 1024 * 1024) er.photo = 'La foto puede pesar máximo 5 MB';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true); setError('');
    try {
      const body = { ...f, area_id: Number(f.area_id), position_id: Number(f.position_id) };
      const saved = edit ? await api.put(`/users/${user.id}`, body) : await api.post('/users', body);
      if (photo) {
        const fd = new FormData(); fd.append('context', 'avatar'); fd.append('userId', saved.id); fd.append('files', photo);
        try { await api.upload('/files', fd); } catch (err) { toast.error(`La persona se guardó, pero la foto no: ${err.message}`); }
      }
      invalidateDirectory();
      toast.success(edit ? 'Datos actualizados' : `${saved.first_name} fue creado(a). Usuario: ${saved.username}`);
      onClose(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={() => !busy && onClose(false)} title={edit ? 'Editar persona' : 'Crear usuario'} width={792}>
      <form onSubmit={submit} noValidate className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-7">
        <h2 className="text-[20px] font-semibold text-ink">{edit ? 'Editar datos de la persona' : 'Datos de la persona'}</h2>
        <div className="mt-4 grid gap-x-5 gap-y-3.5 sm:grid-cols-2">
          <Input label="Primer nombre" required value={f.first_name} onChange={set('first_name')} error={errs.first_name} maxLength={60} autoFocus />
          <Input label="Segundo nombre" value={f.second_name} onChange={set('second_name')} maxLength={60} />
          <Input label="Primer apellido" required value={f.last_name} onChange={set('last_name')} error={errs.last_name} maxLength={60} />
          <Input label="Segundo apellido" value={f.second_last_name} onChange={set('second_last_name')} maxLength={60} />
          <Input label="Número de documento" required value={f.document} onChange={set('document')} error={errs.document} maxLength={30} inputMode="numeric" />
          <Input label="Teléfono" required type="tel" value={f.phone} onChange={set('phone')} error={errs.phone} maxLength={30} />
          <Input label="Fecha de ingreso" required type="date" value={f.hire_date} onChange={set('hire_date')} error={errs.hire_date} />
          <Input label="Fecha de nacimiento" required type="date" value={f.birth_date} onChange={set('birth_date')} error={errs.birth_date} />
          <Select label="Área" required value={f.area_id} onChange={set('area_id')} error={errs.area_id}>
            <option value="">{areas ? (areas.length ? 'Selecciona un área…' : 'Primero crea un área') : 'Cargando…'}</option>
            {(areas || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select label="Cargo" required value={f.position_id} onChange={set('position_id')} error={errs.position_id} disabled={!f.area_id}>
            <option value="">{!f.area_id ? 'Elige primero el área' : areaPositions.length ? 'Selecciona un cargo…' : 'Esta área aún no tiene cargos'}</option>
            {areaPositions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          {edit && <Input label="Correo corporativo" type="email" value={f.email} onChange={set('email')} maxLength={160} className="sm:col-span-2" />}
        </div>
        <div className="mt-4">
          <Dropzone title="Foto de perfil (opcional)" hint="JPG o PNG · Máximo 5 MB" accept="image/png,image/jpeg,image/webp" file={photo} onFile={setPhoto} error={errs.photo} />
        </div>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <div className="mt-5 space-y-3 border-t border-line pt-5 text-[12px] leading-[1.5] text-muted">
          <p>El cargo define su lugar en el organigrama. El área, al lugar donde pertenece.</p>
          {!edit && <p>{f.first_name.trim() || 'La persona'} ingresará con su número de documento como contraseña inicial y deberá cambiarla en su primer inicio de sesión. Su usuario se genera automáticamente.</p>}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="submit" icon={edit ? Check : UserPlus} loading={busy}>{edit ? 'Guardar cambios' : 'Crear usuario'}</Button>
          <Button variant="secondary" onClick={() => onClose(false)} disabled={busy}>Cancelar</Button>
        </div>
        <p className="mt-4 text-[11px] text-muted">* Campos obligatorios</p>
      </form>
    </Modal>
  );
}

/* ---------------------------- Editar permisos ---------------------------- */
export function AccessModal({ user, onClose, onEdit }) {
  const toast = useToast();
  const [level, setLevel] = useState(user.level);
  const [perms, setPerms] = useState(user.permissions);
  const [active, setActive] = useState(user.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // 'reset' | 'delete'
  const [info, setInfo] = useState('');

  const pickLevel = (v) => { setLevel(v); setPerms(LEVEL_PERMS[v]); };
  const toggle = (p, on) => setPerms((l) => (on ? [...new Set([...l, p])] : l.filter((x) => x !== p)));
  const dirty = level !== user.level || active !== user.active || [...perms].sort().join() !== [...user.permissions].sort().join();

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.put(`/users/${user.id}/access`, { level, permissions: perms, active });
      invalidateDirectory();
      toast.success('Permisos actualizados');
      onClose(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function doReset() {
    await api.post(`/users/${user.id}/reset-password`);
    setConfirm(null); setInfo(`La contraseña de ${user.first_name} volvió a ser su número de documento y deberá cambiarla al ingresar.`);
  }
  async function doDelete() {
    await api.del(`/users/${user.id}`);
    invalidateDirectory();
    toast.success('Persona eliminada'); onClose(true);
  }

  return (
    <Modal open onClose={() => !busy && onClose(false)} title="Editar permisos" width={792}>
      <form onSubmit={save} className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-7">
        <h2 className="text-[20px] font-semibold text-ink">Editar permisos</h2>
        <div className="mt-4 flex items-center gap-3">
          <Avatar fileId={user.photo_file_id} name={user.name} size={44} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[12px] text-muted">{[user.position_name, user.area_name].filter(Boolean).join(' · ') || 'Sin cargo'} · Usuario: {user.username}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
          <Select label="Nivel de acceso" value={level} onChange={(e) => pickLevel(e.target.value)} hint={LEVELS.find((l) => l.value === level)?.hint}>
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
          <Select label="Estado" value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')} hint={active ? 'Puede iniciar sesión.' : 'No podrá iniciar sesión.'}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </Select>
        </div>
        <fieldset className="mt-5 rounded-xl border border-line p-4">
          <legend className="px-1 text-[12px] font-semibold text-ink">Permisos</legend>
          <div className="space-y-3">
            {Object.entries(PERM_LABEL).map(([k, label]) => (
              <Checkbox key={k} checked={perms.includes(k)} onChange={(on) => toggle(k, on)}>{label}</Checkbox>
            ))}
          </div>
        </fieldset>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        {info && <p className="mt-4 rounded-lg bg-ok-bg px-3 py-2.5 text-[13px] text-ok">{info}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="submit" icon={Check} loading={busy} disabled={!dirty}>Guardar cambios</Button>
          <Button variant="secondary" onClick={() => onClose(false)} disabled={busy}>Cancelar</Button>
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-[12px] font-semibold text-ink">Otras acciones</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={() => onEdit(user)}>Editar datos de la persona</Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirm('reset')}>Restablecer contraseña</Button>
            <Button variant="danger" size="sm" onClick={() => setConfirm('delete')}>Eliminar persona</Button>
          </div>
        </div>
      </form>
      <ConfirmModal open={confirm === 'reset'} title="Restablecer contraseña" message={`La contraseña de ${user.name} volverá a ser su número de documento y deberá cambiarla al iniciar sesión.`} confirmLabel="Restablecer" onConfirm={doReset} onClose={() => setConfirm(null)} />
      <ConfirmModal open={confirm === 'delete'} danger title="Eliminar persona" message={`Se eliminará a ${user.name} junto con su foto y sus tareas. Sus documentos del repositorio se conservan. Si solo quieres que no ingrese, cámbiala a “Inactivo”.`} confirmLabel="Eliminar" onConfirm={doDelete} onClose={() => setConfirm(null)} />
    </Modal>
  );
}
