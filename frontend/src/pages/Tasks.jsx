import { useEffect, useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi, useDebounced } from '../hooks/useApi.js';
import { Button, Card, Chip, ConfirmModal, EmptyState, FullSpinner, Input, PageHeader, Select, cx, useToast } from '../components/ui.jsx';
import FileBox from '../components/FileBox.jsx';
import { KIND_LABEL, formatDate } from '../lib/format.js';
import { TASKS_EVENT, notifyTasksChanged, openCompleteTask, openCreateTask } from '../lib/events.js';

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const monthLabel = (m) => { const [y, mo] = m.split('-').map(Number); const s = new Date(y, mo - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };

function TaskCard({ t, done, me, onDelete }) {
  const overdue = !done && t.due_date && t.due_date < todayIso();
  const file = done && t.completion_file_id ? { id: t.completion_file_id, name: t.completion_file_name, size: t.completion_file_size } : t.file_id ? { id: t.file_id, name: t.file_name, size: t.file_size } : null;
  const mine = t.creator_id === me;
  return (
    <Card className="flex flex-col p-6">
      <p className="text-[10px] font-semibold uppercase leading-[1.6] text-brand">{KIND_LABEL[t.kind]}</p>
      <h2 className="mt-1 text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink">{t.title}</h2>
      <p className="mt-4 whitespace-pre-wrap text-[14px] leading-[1.45] text-muted">{t.description}</p>
      <p className="mt-5 text-[12px] leading-[1.6] text-muted">
        {done ? `Completada: ${formatDate(t.completed_at?.slice(0, 10))}` : <>Entrega: {formatDate(t.due_date)}{overdue && <span className="font-semibold text-danger"> · Vencida</span>}</>}
        <br />
        {t.kind === 'autoasignada' ? <>Creada por ti{done ? ` · Para: ${t.assignee_name}` : ''}</> : <>De: {t.creator_name || 'Persona eliminada'} · Para: {t.assignee_name}</>}
      </p>
      {done && t.completion_note && <p className="mt-3 text-[12px] leading-[1.5] text-ink"><span className="font-semibold">Detalle:</span> {t.completion_note}</p>}
      {file ? <div className="mt-4"><FileBox id={file.id} name={file.name} size={file.size} extra={done && t.completion_file_id ? 'Versión final' : undefined} /></div>
        : <p className="mt-4 text-[12px] text-muted">Sin documento adjunto</p>}
      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          {done ? (
            <span className="flex items-center gap-1.5 text-[12px] text-ok"><Check className="h-3.5 w-3.5" strokeWidth={2.4} />Realizada</span>
          ) : (
            <>
              <Button onClick={() => openCompleteTask(t)} className="px-5 py-3">Realizar</Button>
              {mine && <Button variant="secondary" onClick={() => onDelete(t)} className="px-5 py-3">Eliminar</Button>}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Tasks({ done = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [date, setDate] = useState(done ? todayIso().slice(0, 7) : '');
  const [confirm, setConfirm] = useState(null);
  const dq = useDebounced(q);

  const path = useMemo(() => {
    const p = new URLSearchParams({ status: done ? 'done' : 'pending' });
    if (dq.trim()) p.set('q', dq.trim());
    if (kind) p.set('kind', kind);
    if (date) p.set(done ? 'month' : 'date', date);
    return `/tasks?${p}`;
  }, [done, dq, kind, date]);
  const { data: tasks, loading, reload } = useApi(path);
  const { data: stats, reload: reloadStats } = useApi('/tasks/stats');

  useEffect(() => {
    const h = () => { reload(); reloadStats(); };
    window.addEventListener(TASKS_EVENT, h);
    return () => window.removeEventListener(TASKS_EVENT, h);
  }, [reload, reloadStats]);

  async function remove() {
    await api.del(`/tasks/${confirm.id}`);
    setConfirm(null); toast.success('Tarea eliminada'); notifyTasksChanged();
  }

  const total = stats ? (done ? stats.done : stats.pending) : 0;
  const n = tasks?.length ?? 0;
  const filtered = !!(dq.trim() || kind || (done ? false : date));

  return (
    <div className="max-w-[1112px]">
      <PageHeader
        eyebrow="Tu espacio de trabajo"
        title={done ? 'Tareas realizadas' : 'Mis tareas'}
        subtitle={done ? 'Un registro del trabajo que ya hiciste.' : 'Tu trabajo, organizado. Un paso a la vez.'}
        action={!done && <Button icon={Plus} onClick={() => openCreateTask(null)}>Crear tarea</Button>}
      />
      <Card className="p-[17px]">
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Buscar" placeholder="Buscar por título…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select label="Tipo de tarea" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Todos los tipos</option>
            {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          {done
            ? <Input label="Fecha de realización" type="month" value={date} onChange={(e) => setDate(e.target.value)} />
            : <Input label="Fecha de entrega" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 pl-0.5">
          <Chip>{n} {done ? (n === 1 ? 'realizada' : 'realizadas') : (n === 1 ? 'pendiente' : 'pendientes')}</Chip>
          {done && <span className="text-[11px] text-muted">Ordenar: fecha de realización ↓</span>}
          {!done && <span className="text-[11px] text-muted">Ordenar: fecha de entrega ↑</span>}
          {(date && !done || kind || q) && <button type="button" onClick={() => { setQ(''); setKind(''); if (!done) setDate(''); }} className="text-[11px] font-semibold text-brand hover:underline">Limpiar filtros</button>}
        </div>
      </Card>

      <div className="mt-6">
        {loading && !tasks ? <FullSpinner /> : n === 0 ? (
          <EmptyState title={done ? 'Aún no hay tareas realizadas con estos filtros' : filtered ? 'No hay tareas con estos filtros' : '¡Estás al día!'}>
            {done ? 'Las tareas que completes aparecerán aquí.' : filtered ? 'Prueba con otra búsqueda o limpia los filtros.' : 'No tienes tareas pendientes. Puedes crear una nueva con “Crear tarea”.'}
          </EmptyState>
        ) : (
          <div className={cx('grid items-start gap-6 md:grid-cols-2', loading && 'opacity-60')}>
            {tasks.map((t) => <TaskCard key={t.id} t={t} done={done} me={user.id} onDelete={setConfirm} />)}
          </div>
        )}
      </div>
      <p className="mt-6 text-[12px] text-muted">
        {done ? `Mostrando ${n} de ${total} tareas realizadas · ${monthLabel(date || todayIso().slice(0, 7))}` : `Mostrando ${n} de ${total} tareas.${total === n && n > 0 ? '' : ''}${total === 0 ? ' Todas las tareas están al día.' : ''}`}
      </p>
      <ConfirmModal open={!!confirm} danger title="Eliminar tarea" message={`Se eliminará “${confirm?.title}”. Esta acción no se puede deshacer.`} confirmLabel="Eliminar" onConfirm={remove} onClose={() => setConfirm(null)} />
    </div>
  );
}
