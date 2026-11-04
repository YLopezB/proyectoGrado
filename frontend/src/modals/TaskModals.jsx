import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDirectory } from '../hooks/useDirectory.js';
import { Avatar, Button, Dropzone, ErrorNote, Input, Modal, ModalHeader, Select, Textarea, useToast } from '../components/ui.jsx';
import FileBox from '../components/FileBox.jsx';
import { KIND_LABEL, firstName, formatDate } from '../lib/format.js';
import { notifyTasksChanged } from '../lib/events.js';

const MAX_MB = 20;
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function uploadTaskFile(file) {
  const fd = new FormData();
  fd.append('context', 'task');
  fd.append('files', file);
  const [saved] = await api.upload('/files', fd);
  return saved.id;
}
const checkFile = (f) => (f && f.size > MAX_MB * 1024 * 1024 ? `El archivo supera ${MAX_MB} MB` : '');

/* ---------------------------------- Crear tarea ---------------------------------- */
function CreateTaskModal({ assignee, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const { people } = useDirectory();
  const [target, setTarget] = useState(assignee ? String(assignee.id) : '');
  const [f, setF] = useState({ title: '', description: '', due_date: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errs, setErrs] = useState({});
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const person = assignee || people.find((p) => String(p.id) === target);

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!target) er.target = 'Selecciona a quién va dirigida';
    if (!f.title.trim()) er.title = 'Escribe un título';
    if (!f.description.trim()) er.description = 'Escribe una descripción';
    if (!f.due_date) er.due_date = 'Selecciona la fecha';
    if (checkFile(file)) er.file = checkFile(file);
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true); setError('');
    try {
      const fileId = file ? await uploadTaskFile(file) : undefined;
      await api.post('/tasks', { assignee_id: Number(target), ...f, file_id: fileId });
      toast.success(Number(target) === user.id ? 'Tarea creada' : `Tarea enviada a ${firstName(person?.name)}`);
      notifyTasksChanged();
      onClose(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={() => !busy && onClose(false)} title="Crear tarea" width={600}>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-y-auto" noValidate>
        <ModalHeader title="Crear tarea" subtitle="Define el siguiente paso y compártelo con tu equipo." onClose={() => onClose(false)} />
        <div className="space-y-4 px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
          {assignee ? (
            <div className="flex items-center gap-3">
              <Avatar fileId={assignee.photo_file_id} name={assignee.name} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">{assignee.name}</p>
                <p className="truncate text-[12px] text-muted">Destinatario{assignee.position_name ? ` · ${assignee.position_name}` : ''}</p>
              </div>
            </div>
          ) : (
            <Select label="Destinatario" required value={target} onChange={(e) => setTarget(e.target.value)} error={errs.target}>
              <option value="">Selecciona una persona…</option>
              <option value={user.id}>Yo mismo (autoasignada)</option>
              {people.filter((p) => p.id !== user.id).map((p) => <option key={p.id} value={p.id}>{p.name}{p.position_name ? ` · ${p.position_name}` : ''}</option>)}
            </Select>
          )}
          <Input label="Título de tarea" required value={f.title} onChange={set('title')} maxLength={200} placeholder="Ej. Revisar protocolo de entregas" error={errs.title} />
          <Textarea label="Descripción" required rows={3} value={f.description} onChange={set('description')} placeholder="Explica qué debe hacerse y cómo" error={errs.description} />
          <Input label="Fecha de entrega" required type="date" min={today()} value={f.due_date} onChange={set('due_date')} error={errs.due_date} />
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink">Documento (opcional)</p>
            <Dropzone title="Adjunta un documento" hint={`PDF, DOCX o XLSX · Máximo ${MAX_MB} MB`} accept={ACCEPT} file={file} onFile={setFile} error={errs.file} />
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button variant="secondary" onClick={() => onClose(false)} disabled={busy} className="py-3.5">Cancelar</Button>
            <Button type="submit" icon={Send} loading={busy} className="py-3.5">Enviar</Button>
          </div>
          <p className="text-[11px] text-muted">* Campos obligatorios. El documento es opcional.</p>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------- Realizar tarea ---------------------------------- */
function CompleteTaskModal({ task, onClose }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ferr, setFerr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (checkFile(file)) return setFerr(checkFile(file));
    setBusy(true); setError('');
    try {
      const fileId = file ? await uploadTaskFile(file) : undefined;
      await api.post(`/tasks/${task.id}/complete`, { note, file_id: fileId });
      toast.success('Tarea realizada');
      notifyTasksChanged();
      onClose(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={() => !busy && onClose(false)} title="Realizar tarea" width={546}>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 sm:p-7">
        <p className="text-[10px] font-semibold uppercase leading-[1.6] text-brand">{KIND_LABEL[task.kind]}</p>
        <h2 className="mt-1 text-[24px] font-semibold leading-[1.25] tracking-[-0.01em] text-ink">{task.title}</h2>
        <p className="mt-3 text-[14px] leading-[1.5] text-muted">{task.description}</p>
        <p className="mt-4 text-[12px] leading-[1.6] text-muted">Entrega: {formatDate(task.due_date)}<br />De: {task.creator_name} · Para: {task.assignee_name}</p>
        {task.file_id && <div className="mt-4"><FileBox id={task.file_id} name={task.file_name} size={task.file_size} /></div>}
        <div className="my-5 border-t border-line" />
        <Input label="Detalle" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Cuéntanos qué hiciste" />
        <div className="mt-4"><Dropzone title="Adjunta un documento" hint={`PDF, DOCX o XLSX · Máximo ${MAX_MB} MB`} accept={ACCEPT} file={file} onFile={(f) => { setFerr(''); setFile(f); }} error={ferr} /></div>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <div className="mt-5 flex gap-3">
          <Button type="submit" loading={busy}>Realizar</Button>
          <Button variant="secondary" onClick={() => onClose(false)} disabled={busy}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------- Anfitrión global ---------------------------------- */
export function TaskModalHost() {
  const [create, setCreate] = useState(null);   // { assignee }
  const [complete, setComplete] = useState(null);
  useEffect(() => {
    const a = (e) => setCreate({ assignee: e.detail.assignee });
    const b = (e) => setComplete(e.detail.task);
    window.addEventListener('nexo:create-task', a);
    window.addEventListener('nexo:complete-task', b);
    return () => { window.removeEventListener('nexo:create-task', a); window.removeEventListener('nexo:complete-task', b); };
  }, []);
  return (
    <>
      {create && <CreateTaskModal assignee={create.assignee} onClose={() => setCreate(null)} />}
      {complete && <CompleteTaskModal task={complete} onClose={() => setComplete(null)} />}
    </>
  );
}
