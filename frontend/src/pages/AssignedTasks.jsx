import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { api } from '../api/client.js';
import { useApi, useDebounced } from '../hooks/useApi.js';
import { Avatar, Button, Card, Chip, ConfirmModal, EmptyState, FullSpinner, Input, PageHeader, Select, cx, useToast } from '../components/ui.jsx';
import FileBox from '../components/FileBox.jsx';
import { KIND_LABEL, formatDate } from '../lib/format.js';
import { TASKS_EVENT, notifyTasksChanged, openCreateTask } from '../lib/events.js';

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Tarea que yo asigné a otra persona: muestra el estado, lo que envié y lo que me entregaron
function AssignedTaskCard({ t, onDelete }) {
  const done = t.status === 'done';
  const overdue = !done && t.due_date && t.due_date < todayIso();
  const lateDone = done && t.due_date && t.completed_at?.slice(0, 10) > t.due_date;
  return (
    <Card className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase leading-[1.6] text-brand">{KIND_LABEL[t.kind]}</p>
        {done ? <Chip tone="ok">Realizada</Chip> : overdue ? <Chip className="bg-danger/10 text-danger">Vencida</Chip> : <Chip tone="muted">Pendiente</Chip>}
      </div>
      <h2 className="mt-1 text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink">{t.title}</h2>

      <div className="mt-4 flex items-center gap-3">
        <Avatar fileId={t.assignee_photo} name={t.assignee_name} size={36} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">{t.assignee_name}</p>
          <p className="text-[12px] text-muted">
            Entrega: {formatDate(t.due_date)}
            {done && <> · Realizada: {formatDate(t.completed_at?.slice(0, 10))}{lateDone && <span className="font-semibold text-danger"> (tarde)</span>}</>}
          </p>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-[14px] leading-[1.45] text-muted">{t.description}</p>
      {t.file_id && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Documento enviado</p>
          <FileBox id={t.file_id} name={t.file_name} size={t.file_size} />
        </div>
      )}

      {done && (
        <div className="mt-5 rounded-xl border border-line bg-tint/40 p-4">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ok"><Check className="h-3.5 w-3.5" strokeWidth={2.4} />Entrega de {t.assignee_name.split(' ')[0]}</p>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.5] text-ink">{t.completion_note || <span className="text-muted">Sin detalle.</span>}</p>
          {t.completion_file_id
            ? <div className="mt-3"><FileBox id={t.completion_file_id} name={t.completion_file_name} size={t.completion_file_size} extra="Versión final" /></div>
            : <p className="mt-3 text-[12px] text-muted">No adjuntó documento.</p>}
        </div>
      )}

      {!done && (
        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Button variant="secondary" onClick={() => onDelete(t)} className="px-5 py-3">Eliminar</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function AssignedTasks() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const done = params.get('estado') === 'realizadas';
  const setDone = (d) => setParams(d ? { estado: 'realizadas' } : {}, { replace: true });
  const [q, setQ] = useState('');
  const [assignee, setAssignee] = useState('');
  const [confirm, setConfirm] = useState(null);
  const dq = useDebounced(q);

  const path = useMemo(() => {
    const p = new URLSearchParams({ scope: 'assigned', status: done ? 'done' : 'pending' });
    if (dq.trim()) p.set('q', dq.trim());
    if (assignee) p.set('assignee', assignee);
    return `/tasks?${p}`;
  }, [done, dq, assignee]);
  const { data: tasks, loading, reload } = useApi(path);
  const { data: stats, reload: reloadStats } = useApi('/tasks/stats?scope=assigned');

  useEffect(() => {
    const h = () => { reload(); reloadStats(); };
    window.addEventListener(TASKS_EVENT, h);
    return () => window.removeEventListener(TASKS_EVENT, h);
  }, [reload, reloadStats]);

  async function remove() {
    try {
      await api.del(`/tasks/${confirm.id}`);
      toast.success('Tarea eliminada'); notifyTasksChanged();
    } catch (e) { toast.error(e.message); } finally { setConfirm(null); }
  }

  const n = tasks?.length ?? 0;
  const filtered = !!(dq.trim() || assignee);
  const tabs = [
    { key: false, label: 'Pendientes', count: stats?.pending },
    { key: true, label: 'Realizadas', count: stats?.done },
  ];

  return (
    <div className="max-w-[1112px]">
      <PageHeader
        eyebrow="Tu espacio de trabajo"
        title="Tareas asignadas"
        subtitle="Las tareas que enviaste a otras personas y lo que te entregaron."
        action={<Button icon={Plus} onClick={() => openCreateTask(null)}>Crear tarea</Button>}
      />

      <div className="mb-4 flex gap-2" role="tablist">
        {tabs.map((tab) => (
          <button key={tab.label} type="button" role="tab" aria-selected={done === tab.key} onClick={() => setDone(tab.key)}
            className={cx('rounded-full px-4 py-2 text-[13px] font-semibold transition-colors', done === tab.key ? 'bg-brand text-white' : 'bg-white text-muted hover:text-ink')}>
            {tab.label}{tab.count != null && <span className="ml-1.5 opacity-80">{tab.count}</span>}
          </button>
        ))}
      </div>

      <Card className="p-[17px]">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Buscar" placeholder="Buscar por título o persona…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select label="Persona" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Todas las personas</option>
            {(stats?.people || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 pl-0.5">
          <Chip>{n} {done ? (n === 1 ? 'realizada' : 'realizadas') : (n === 1 ? 'pendiente' : 'pendientes')}</Chip>
          {!done && stats?.overdue > 0 && <Chip className="bg-danger/10 text-danger">{stats.overdue} {stats.overdue === 1 ? 'vencida' : 'vencidas'}</Chip>}
          <span className="text-[11px] text-muted">{done ? 'Ordenar: fecha de realización ↓' : 'Ordenar: fecha de entrega ↑'}</span>
          {filtered && <button type="button" onClick={() => { setQ(''); setAssignee(''); }} className="text-[11px] font-semibold text-brand hover:underline">Limpiar filtros</button>}
        </div>
      </Card>

      <div className="mt-6">
        {loading && !tasks ? <FullSpinner /> : n === 0 ? (
          <EmptyState title={filtered ? 'No hay tareas con estos filtros' : done ? 'Aún no te han entregado tareas' : 'No tienes tareas asignadas pendientes'}>
            {filtered ? 'Prueba con otra búsqueda o limpia los filtros.'
              : done ? 'Cuando alguien realice una tarea que le asignaste, verás aquí su detalle y el documento que adjuntó.'
                : 'Asigna una tarea con “Crear tarea” y elige a otra persona como destinataria.'}
          </EmptyState>
        ) : (
          <div className={cx('grid items-start gap-6 md:grid-cols-2', loading && 'opacity-60')}>
            {tasks.map((t) => <AssignedTaskCard key={t.id} t={t} onDelete={setConfirm} />)}
          </div>
        )}
      </div>

      <ConfirmModal open={!!confirm} danger title="Eliminar tarea" message={`Se eliminará “${confirm?.title}” asignada a ${confirm?.assignee_name}. Esta acción no se puede deshacer.`} confirmLabel="Eliminar" onConfirm={remove} onClose={() => setConfirm(null)} />
    </div>
  );
}
