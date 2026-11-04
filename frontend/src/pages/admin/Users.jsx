import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, UserPlus } from 'lucide-react';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { Avatar, Button, Card, EmptyState, FullSpinner, Input, PageHeader, Select, cx } from '../../components/ui.jsx';
import { AccessModal, UserFormModal } from '../../modals/UserModals.jsx';
import { LEVELS } from '../../lib/format.js';

const PAGE = 7;

export default function Users() {
  const [q, setQ] = useState('');
  const [areaId, setAreaId] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(0);
  const [form, setForm] = useState(null);     // null | { user? }
  const [access, setAccess] = useState(null);
  const dq = useDebounced(q);

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (dq.trim()) p.set('q', dq.trim());
    if (areaId) p.set('areaId', areaId);
    if (status) p.set('status', status);
    return `/users?${p}`;
  }, [dq, areaId, status]);
  const { data: users, loading, reload } = useApi(path);
  const { data: stats, reload: reloadStats } = useApi('/users/stats');
  const { data: areas } = useApi('/areas');
  useEffect(() => setPage(0), [dq, areaId, status]);

  const total = users?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const rows = (users || []).slice(page * PAGE, page * PAGE + PAGE);
  const refresh = () => { reload(); reloadStats(); };
  const levelLabel = (v) => LEVELS.find((l) => l.value === v)?.label || v;

  return (
    <div className="max-w-[1112px]">
      <PageHeader eyebrow="Administración / Personas" title="Usuarios y permisos" action={<Button icon={UserPlus} onClick={() => setForm({})}>Crear usuario</Button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        {[['Usuarios', stats?.total], ['Activos', stats?.active], ['Inactivos', stats?.inactive]].map(([l, v]) => (
          <Card key={l} className="px-6 pb-6 pt-7"><p className="text-[32px] font-semibold leading-none text-ink">{v ?? '–'}</p><p className="mt-5 text-[13px] text-muted">{l}</p></Card>
        ))}
      </div>

      <Card className="mt-6 p-5 sm:p-[23px]">
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Buscar persona" placeholder="Nombre o correo…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select label="Área" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">Todas las áreas</option>
            {(areas || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="">Todos</option>
          </Select>
        </div>
        <div className="mt-5 border-t border-line">
          {loading && !users ? <FullSpinner /> : rows.length === 0 ? (
            <div className="py-10"><EmptyState title={stats?.total ? 'No hay personas con estos filtros' : 'Aún no hay personas'}>{stats?.total ? 'Prueba con otra búsqueda.' : 'Crea primero las áreas y cargos y luego agrega a las personas con “Crear usuario”.'}</EmptyState></div>
          ) : (
            <ul className={cx(loading && 'opacity-60')}>
              {rows.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line py-[19px]">
                  <Avatar fileId={u.photo_file_id} name={u.name} size={40} />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-[14px] font-semibold leading-[1.4] text-ink">{u.name}</p>
                    <p className="truncate text-[11px] leading-[1.6] text-muted">{[u.position_name, u.area_name].filter(Boolean).join(' · ') || 'Sin cargo asignado'}</p>
                  </div>
                  <div className="w-[190px] text-[12px] leading-[1.5] text-brand">
                    <p>{levelLabel(u.level)}</p>
                    <p className={cx('flex items-center gap-1', !u.active && 'text-muted')}>{u.active ? <><Check className="h-3 w-3" strokeWidth={2.2} /> Activo</> : 'Inactivo'}{u.must_change_password && u.active ? <span className="text-muted"> · Aún no ingresa</span> : null}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setAccess(u)} className="px-4 py-2.5">Editar permisos</Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-[11px] text-muted">{rows.length} de {total} usuarios {status === 'active' ? 'activos' : status === 'inactive' ? 'inactivos' : ''} · Página {page + 1} de {pages}</p>
            <div className="flex gap-2">
              {page > 0 && <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)}>Anterior</Button>}
              {page < pages - 1 && <Button variant="secondary" size="sm" icon={ArrowRight} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>}
            </div>
          </div>
        </div>
      </Card>

      {form && <UserFormModal user={form.user} onClose={(saved) => { setForm(null); if (saved) refresh(); }} />}
      {access && <AccessModal user={access} onClose={(saved) => { setAccess(null); if (saved) refresh(); }} onEdit={(u) => { setAccess(null); setForm({ user: u }); }} />}
    </div>
  );
}
