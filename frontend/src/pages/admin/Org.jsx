import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCompany } from '../../context/CompanyContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { Avatar, Button, Card, Chip, EmptyState, FullSpinner, PageHeader, cx } from '../../components/ui.jsx';
import { formatDate, plural } from '../../lib/format.js';

function PersonCard({ p, count, me }) {
  return (
    <div className={cx('rounded-xl border border-line px-4 py-3.5', me ? 'bg-tint' : 'bg-white')}>
      <div className="flex items-center gap-3">
        <Avatar fileId={p.photo_file_id} name={p.name} size={me ? 40 : 36} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold leading-[1.4] text-ink">{p.name}</p>
          <p className="truncate text-[11px] leading-[1.5] text-muted">{p.position_name || 'Sin cargo'}{count > 1 ? ` · ${plural(count, 'persona', 'personas')}` : ''}</p>
        </div>
      </div>
      {me && <p className="mt-3 text-[11px] font-semibold text-brand">Tú estás aquí</p>}
    </div>
  );
}

function AreaColumn({ area, areas, people, depthOf, me, nested = false, parentName }) {
  const members = people.filter((p) => p.area_id === area.id).sort((a, b) => (depthOf(a.position_id) - depthOf(b.position_id)) || a.name.localeCompare(b.name, 'es'));
  const counts = people.reduce((m, p) => m.set(p.position_id, (m.get(p.position_id) || 0) + 1), new Map());
  const subs = areas.filter((a) => a.parent_id === area.id);
  return (
    <div className="min-w-0">
      <h3 className={cx('text-center font-semibold text-ink', nested ? 'mt-6 text-[15px]' : 'text-[20px]')}>{area.name}</h3>
      <p className="mb-3 mt-1 text-center text-[11px] text-muted">{plural(area.people, 'persona', 'personas')}{parentName ? ` · Reporta a ${parentName}` : ''}</p>
      <div>
        {members.length === 0 && <p className="rounded-xl border border-dashed border-line px-4 py-3 text-center text-[12px] text-muted">Sin integrantes</p>}
        {members.map((p, i) => (
          <div key={p.id} className="relative">
            {i > 0 && <span className="mx-auto block h-4 w-px bg-line" aria-hidden="true" />}
            <PersonCard p={p} count={counts.get(p.position_id)} me={p.id === me} />
          </div>
        ))}
      </div>
      {subs.map((s) => <AreaColumn key={s.id} area={s} areas={areas} people={people} depthOf={depthOf} me={me} nested parentName={area.name} />)}
    </div>
  );
}

export default function Org() {
  const { user } = useAuth();
  const company = useCompany();
  const { data: areas, loading } = useApi('/areas');
  const { data: positions } = useApi('/positions');
  const { data: people } = useApi('/users/directory');

  const depthOf = useMemo(() => {
    const byId = new Map((positions || []).map((p) => [p.id, p]));
    return (id) => { let d = 0; let cur = byId.get(id); const seen = new Set(); while (cur?.reports_to_id && !seen.has(cur.id)) { seen.add(cur.id); d++; cur = byId.get(cur.reports_to_id); } return d; };
  }, [positions]);

  if (loading || !areas || !people) return <FullSpinner />;
  const tops = areas.filter((a) => !a.parent_id);
  const root = tops.length === 1 ? tops[0] : null;
  const columns = root ? areas.filter((a) => a.parent_id === root.id) : tops;
  const leader = root?.leader_id ? people.find((p) => p.id === root.leader_id) : null;
  const rootPeople = root ? people.filter((p) => p.area_id === root.id) : [];
  const head = leader || rootPeople.sort((a, b) => depthOf(a.position_id) - depthOf(b.position_id))[0];
  const totalPositions = positions?.length || 0;
  const me = user.id || 0;

  return (
    <div className="max-w-[1112px]">
      <PageHeader eyebrow={`${company.name} / Estructura`} title="Organigrama" subtitle="Conoce cómo organizamos y quién conecta con quién."
        action={<Button variant="secondary" icon={Download} className="no-print" onClick={() => window.print()}>Descargar PDF</Button>} />
      {areas.length === 0 ? <EmptyState title="Aún no hay estructura">Crea áreas y cargos para ver el organigrama.</EmptyState> : (
        <Card className="p-5 sm:p-[31px]">
          <div className="flex flex-wrap gap-2.5">
            <Chip>{plural(people.length, 'persona', 'personas')}</Chip>
            <Chip>{plural(areas.length, 'área', 'áreas')} · {plural(totalPositions, 'cargo', 'cargos')}</Chip>
          </div>

          {root && (
            <div className="mx-auto mt-5 w-full max-w-[300px] rounded-2xl border border-line bg-tint px-5 py-5">
              <p className="text-[10px] font-semibold uppercase leading-[1.5] text-brand">{root.name} · {plural(root.people, 'persona', 'personas')}</p>
              {head ? (<><p className="mt-4 text-[14px] font-semibold text-ink">{head.name}</p><p className="text-[11px] text-muted">{head.position_name || 'Sin cargo'}</p></>) : <p className="mt-4 text-[12px] text-muted">Sin integrantes</p>}
            </div>
          )}

          <div className="overflow-x-auto pb-2">
            <div className="mx-auto" style={{ minWidth: Math.min(columns.length, 3) * 280 }}>
              <div className={cx('grid gap-x-5 gap-y-8', columns.length >= 3 ? 'lg:grid-cols-3' : columns.length === 2 ? 'lg:grid-cols-2' : '')}
                style={{ gridTemplateColumns: columns.length ? undefined : undefined }}>
                {columns.map((c, i) => (
                  <div key={c.id} className="relative pt-8">
                    {/* conectores: tallo vertical y tramos horizontales */}
                    <span className="absolute left-1/2 top-0 h-6 w-px bg-line" aria-hidden="true" />
                    {columns.length > 1 && <span className={cx('absolute top-0 hidden h-px bg-line lg:block', i === 0 ? 'left-1/2 right-0' : i === columns.length - 1 ? 'left-0 right-1/2' : 'left-0 right-0')} aria-hidden="true" />}
                    <AreaColumn area={c} areas={areas} people={people} depthOf={depthOf} me={me} parentName={root?.name} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-8 text-[11px] text-muted">Las líneas indican dependencia directa entre áreas; dentro de cada área, las personas se ordenan según el cargo al que reportan.</p>
        </Card>
      )}
      <p className="mt-6 text-[11px] text-muted">Estructura actualizada: {formatDate(new Date().toISOString().slice(0, 10))}</p>
    </div>
  );
}
