import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { useCompany } from '../../context/CompanyContext.jsx';
import { Button, Card, Chip, EmptyState, FullSpinner, Input, PageHeader, Select, cx } from '../../components/ui.jsx';
import { AreaModal, PositionModal } from '../../modals/OrgModals.jsx';
import { plural } from '../../lib/format.js';

const Tabs = ({ tab }) => (
  <div className="mb-6 flex gap-3" role="tablist">
    {[['areas', 'Áreas'], ['cargos', 'Cargos']].map(([k, l]) => (
      <Link key={k} to={`/admin/${k}`} role="tab" aria-selected={tab === k}
        className={cx('rounded-lg border px-4 py-[11px] text-[13px] font-semibold', tab === k ? 'border-brand bg-brand text-white' : 'border-line bg-white text-brand hover:bg-tint')}>{l}</Link>
    ))}
  </div>
);

function Areas() {
  const [q, setQ] = useState('');
  const { data: areas, loading, reload } = useApi('/areas');
  const { data: positions, reload: reloadPos } = useApi('/positions');
  const [modal, setModal] = useState(null);
  const list = (areas || []).filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase()));
  const people = (areas || []).reduce((n, a) => n + a.people, 0);
  return (
    <>
      <PageHeader eyebrow="Administración / Áreas y cargos" title="Áreas de la empresa" subtitle="Una estructura clara para un equipo conectado." action={<Button icon={Plus} onClick={() => setModal({})}>Crear área</Button>} />
      <Tabs tab="areas" />
      <Input label="Buscar área" placeholder="Nombre del área…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-5 space-y-5">
        {loading && !areas ? <FullSpinner /> : list.length === 0 ? <EmptyState title={q ? 'No hay áreas con ese nombre' : 'Aún no hay áreas'}>{q ? '' : 'Crea la primera con “Crear área”. Luego podrás agregar cargos y personas.'}</EmptyState> : list.map((a) => (
          <Card key={a.id} className="px-6 pb-6 pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 shrink-0 text-muted" strokeWidth={1.25} />
              <h2 className="min-w-0 flex-1 truncate text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink">{a.name}</h2>
              <Chip tone={a.active ? 'ok' : 'muted'}>{a.active ? 'Activa' : 'Inactiva'}</Chip>
            </div>
            <p className="mt-5 text-[13px] text-muted">Responsable: {a.leader_name || 'Sin asignar'}</p>
            <p className="mt-4 text-[13px] text-ink">{plural(a.people, 'persona', 'personas')} · {plural(a.subareas, 'área', 'áreas')}</p>
            <Button variant="secondary" size="sm" className="mt-5 px-3.5" onClick={() => setModal({ area: a })}>Editar área</Button>
          </Card>
        ))}
      </div>
      <p className="mt-5 text-[11px] text-muted">{plural(areas?.length || 0, 'área', 'áreas')} · {plural(people, 'persona', 'personas')} · {plural(positions?.length || 0, 'cargo', 'cargos')}</p>
      {modal && <AreaModal area={modal.area} onClose={(saved) => { setModal(null); if (saved) { reload(); reloadPos(); } }} />}
    </>
  );
}

function Positions() {
  const [q, setQ] = useState('');
  const [areaId, setAreaId] = useState('');
  const { data: areas } = useApi('/areas');
  const { data: positions, loading, reload } = useApi('/positions');
  const [modal, setModal] = useState(null);
  const list = (positions || []).filter((p) => (!areaId || String(p.area_id) === areaId) && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <PageHeader eyebrow="Administración / Áreas y cargos" title="Cargos y responsabilidades" subtitle="Cada persona tiene un lugar. Cada cargo, un propósito." action={<Button icon={Plus} onClick={() => setModal({})}>Crear cargo</Button>} />
      <Tabs tab="cargos" />
      <div className="grid gap-3 md:grid-cols-2">
        <Select label="Filtrar por área" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Todas</option>
          {(areas || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Input label="Buscar cargo" placeholder="Nombre del cargo…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-5 space-y-5">
        {loading && !positions ? <FullSpinner /> : list.length === 0 ? <EmptyState title={q || areaId ? 'No hay cargos con estos filtros' : 'Aún no hay cargos'}>{q || areaId ? '' : 'Crea primero un área y luego sus cargos con “Crear cargo”.'}</EmptyState> : list.map((p) => (
          <Card key={p.id} className="px-6 pb-6 pt-7">
            <h2 className="text-[22px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink">{p.name}</h2>
            <p className="mt-0.5 text-[12px] text-muted">{p.area_name}</p>
            <p className="mt-4 text-[13px] text-ink">{p.holders.slice(0, 2).join(', ') || 'Sin personas'}{p.people > 0 ? ` · ${plural(p.people, 'persona', 'personas')}` : ''}</p>
            <p className="mt-4 text-[12px] text-muted">Reporta a: {p.reports_to_name || 'Ninguno'}</p>
            <Button variant="secondary" size="sm" className="mt-4 px-3.5" onClick={() => setModal({ position: p })}>Editar cargo</Button>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-muted">{plural(positions?.length || 0, 'cargo', 'cargos')} en la empresa</p>
      <Card tint className="mt-5 px-6 py-6 text-[13px] text-ink">Los cargos ordenan la estructura de la empresa. Los permisos se configuran por separado en Usuarios y permisos.</Card>
      {modal && <PositionModal position={modal.position} onClose={(saved) => { setModal(null); if (saved) reload(); }} />}
    </>
  );
}

export default function AreasPositions({ tab }) {
  return <div className="max-w-[1112px]">{tab === 'cargos' ? <Positions /> : <Areas />}</div>;
}
