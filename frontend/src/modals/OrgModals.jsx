import { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { api } from '../api/client.js';
import { useCompany } from '../context/CompanyContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { Button, Checkbox, ConfirmModal, ErrorNote, Input, Modal, Select, Textarea, useToast } from '../components/ui.jsx';

function InfoNote({ children }) {
  return (
    <div className="mt-5 rounded-xl border border-line bg-tint p-5 text-[13px] leading-[1.55] text-ink">
      <FolderPlus className="mb-3 h-5 w-5 text-brand" strokeWidth={1.5} />{children}
    </div>
  );
}

/* ---------------------------- Crear / editar área ---------------------------- */
export function AreaModal({ area, onClose }) {
  const toast = useToast();
  const company = useCompany();
  const edit = !!area;
  const { data: areas } = useApi('/areas');
  const { data: people } = useApi(edit ? '/users/directory' : null);
  const [f, setF] = useState({
    name: area?.name || '', description: area?.description || '', parent_id: area?.parent_id ?? '', leader_id: area?.leader_id ?? '', active: area?.active ?? true,
  });
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const members = (people || []).filter((p) => p.area_id === area?.id);

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = 'Escribe el nombre';
    if (!f.description.trim()) er.description = 'Escribe la descripción';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true); setError('');
    try {
      const body = { name: f.name, description: f.description, parent_id: f.parent_id === '' ? null : Number(f.parent_id), leader_id: f.leader_id === '' ? null : Number(f.leader_id), active: f.active };
      if (edit) await api.put(`/areas/${area.id}`, body); else await api.post('/areas', body);
      toast.success(edit ? 'Área actualizada' : 'Área creada');
      onClose(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function remove() {
    await api.del(`/areas/${area.id}`);
    toast.success('Área eliminada'); onClose(true);
  }

  return (
    <Modal open onClose={() => !busy && onClose(false)} title={edit ? 'Editar área' : 'Crear área'} width={430}>
      <form onSubmit={submit} noValidate className="min-h-0 flex-1 overflow-y-auto p-6">
        <h2 className="text-[20px] font-semibold text-ink">{edit ? 'Editar área' : 'Crear área'}</h2>
        <div className="mt-4 space-y-3.5">
          <Input label="Nombre del área" required value={f.name} onChange={set('name')} maxLength={120} error={errs.name} autoFocus />
          <Textarea label="Descripción" required rows={4} value={f.description} onChange={set('description')} error={errs.description} />
          <Select label="Responsable" value={f.leader_id} onChange={set('leader_id')} disabled={!edit || members.length === 0} hint="Puedes asignarlo cuando el área tenga integrantes.">
            <option value="">Seleccionar persona</option>
            {members.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Depende de" required value={f.parent_id} onChange={set('parent_id')}>
            <option value="">Ninguna (área de nivel superior)</option>
            {(areas || []).filter((a) => a.id !== area?.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          {edit && <Checkbox checked={f.active} onChange={(v) => setF((s) => ({ ...s, active: v }))}>Área activa</Checkbox>}
        </div>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <div className="mt-5 space-y-3 border-t border-line pt-5">
          <Button type="submit" loading={busy} className="w-full py-3.5">Guardar cambios</Button>
          <Button variant="secondary" onClick={() => onClose(false)} disabled={busy} className="w-full py-3.5">Cancelar</Button>
          {edit && <Button variant="danger" onClick={() => setConfirm(true)} disabled={busy} className="w-full py-3">Eliminar área</Button>}
        </div>
        <p className="mt-4 text-[11px] text-muted">* Campos obligatorios</p>
        <InfoNote>Se creará una carpeta dentro de {company.name}. Las áreas que añadas tendrán su propia subcarpeta.</InfoNote>
      </form>
      <ConfirmModal open={confirm} danger title="Eliminar área" message={`Se eliminará el área “${area?.name}”. Solo es posible si no tiene personas, subáreas ni documentos.`} confirmLabel="Eliminar" onConfirm={remove} onClose={() => setConfirm(false)} />
    </Modal>
  );
}

/* ---------------------------- Crear / editar cargo ---------------------------- */
export function PositionModal({ position, onClose }) {
  const toast = useToast();
  const company = useCompany();
  const edit = !!position;
  const { data: areas } = useApi('/areas');
  const { data: positions } = useApi('/positions');
  const [f, setF] = useState({ name: position?.name || '', area_id: position?.area_id ?? '', description: position?.description || '', reports_to_id: position?.reports_to_id ?? '' });
  const [errs, setErrs] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const areaName = (areas || []).find((a) => String(a.id) === String(f.area_id))?.name;

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = 'Escribe el nombre';
    if (!f.area_id) er.area_id = 'Selecciona el área';
    if (!f.description.trim()) er.description = 'Describe las responsabilidades';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true); setError('');
    try {
      const body = { name: f.name, area_id: Number(f.area_id), description: f.description, reports_to_id: f.reports_to_id === '' ? null : Number(f.reports_to_id) };
      if (edit) await api.put(`/positions/${position.id}`, body); else await api.post('/positions', body);
      toast.success(edit ? 'Cargo actualizado' : 'Cargo creado');
      onClose(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={() => !busy && onClose(false)} title={edit ? 'Editar cargo' : 'Crear cargo'} width={430}>
      <form onSubmit={submit} noValidate className="min-h-0 flex-1 overflow-y-auto p-6">
        <h2 className="text-[20px] font-semibold text-ink">{edit ? 'Editar cargo' : 'Crear cargo'}</h2>
        <div className="mt-4 space-y-3.5">
          <Input label="Nombre del cargo" required value={f.name} onChange={set('name')} maxLength={120} error={errs.name} autoFocus />
          <Select label="Área" required value={f.area_id} onChange={set('area_id')} error={errs.area_id}>
            <option value="">{areas?.length === 0 ? 'Primero crea un área' : 'Selecciona un área…'}</option>
            {(areas || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Textarea label="Descripción de responsabilidades" required rows={4} value={f.description} onChange={set('description')} error={errs.description} />
          <Select label="Reporta a" required value={f.reports_to_id} onChange={set('reports_to_id')}>
            <option value="">Ninguno (cargo superior)</option>
            {(positions || []).filter((p) => p.id !== position?.id).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.area_name}</option>)}
          </Select>
        </div>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <div className="mt-5 space-y-3 border-t border-line pt-5">
          <Button type="submit" loading={busy} className="w-full py-3.5">Guardar cambios</Button>
          <Button variant="secondary" onClick={() => onClose(false)} disabled={busy} className="w-full py-3.5">Cancelar</Button>
          {edit && <Button variant="danger" onClick={() => setConfirm(true)} disabled={busy} className="w-full py-3">Eliminar cargo</Button>}
        </div>
        <p className="mt-4 text-[11px] text-muted">* Campos obligatorios.{f.name.trim() && areaName ? ` Se creará una subcarpeta en ${company.name} / ${areaName} / ${f.name.trim()}.` : ''}</p>
        <InfoNote>Se creará una carpeta dentro de {company.name}. Los cargos que añadas tendrán su propia subcarpeta.</InfoNote>
      </form>
      <ConfirmModal open={confirm} danger title="Eliminar cargo" message={`Se eliminará el cargo “${position?.name}”. Solo es posible si no tiene personas ni documentos.`} confirmLabel="Eliminar"
        onConfirm={async () => { await api.del(`/positions/${position.id}`); toast.success('Cargo eliminado'); onClose(true); }} onClose={() => setConfirm(false)} />
    </Modal>
  );
}
