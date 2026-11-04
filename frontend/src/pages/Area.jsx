import { useMemo } from 'react';
import { ListChecks, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCompany } from '../context/CompanyContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDirectory } from '../hooks/useDirectory.js';
import { Avatar, Button, Card, Chip, EmptyState, FullSpinner } from '../components/ui.jsx';
import { openCreateTask } from '../lib/events.js';
import { plural } from '../lib/format.js';

function PersonRow({ p, me }) {
  const chat = useChat();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar fileId={p.photo_file_id} name={p.name} size={40} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-[14px] font-semibold leading-[1.5] text-ink">{p.name}</p>
        <p className="truncate text-[11px] leading-[1.5] text-muted">{p.position_name || 'Sin cargo'}{me ? ' - Tú' : ''}</p>
      </div>
      {!me && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={MessageSquare} onClick={() => chat.openChat(p)}>Chat</Button>
          <Button variant="secondary" size="sm" icon={ListChecks} onClick={() => openCreateTask(p)}>Solicitar tarea</Button>
        </div>
      )}
    </div>
  );
}

export default function Area() {
  const { user } = useAuth();
  const company = useCompany();
  const { data: areas, loading } = useApi('/areas');
  const { people, loading: l2 } = useDirectory();

  const view = useMemo(() => {
    if (!areas || !user.areaId) return null;
    const area = areas.find((a) => a.id === user.areaId);
    if (!area) return null;
    const subs = areas.filter((a) => a.parent_id === area.id);
    const members = (id) => people.filter((p) => p.area_id === id);
    return { area, subs, members, total: members(area.id).length };
  }, [areas, people, user.areaId]);

  if (loading || l2) return <FullSpinner />;
  if (!view) return <EmptyState title="Aún no tienes un área asignada">Pide al administrador que te asigne un área y un cargo para ver aquí a tu equipo.</EmptyState>;

  const { area, subs, members } = view;
  const leader = area.leader_id ? people.find((p) => p.id === area.leader_id) : null;
  const own = members(area.id).filter((p) => p.id !== area.leader_id);
  const sections = [...subs.map((s) => ({ id: s.id, name: s.name, list: members(s.id) })), { id: area.id, name: own.length || !subs.length ? area.name : null, list: own }].filter((s) => s.name && s.list.length);

  return (
    <div className="max-w-[1112px] space-y-6">
      <p className="pb-1 text-[10px] font-semibold uppercase leading-[1.6] text-brand">{[company.name, area.name, user.position].filter(Boolean).join(' / ')}</p>
      <Card tint className="p-6">
        <h1 className="text-[26px] font-semibold leading-[1.3] text-ink sm:text-[28px]">{area.name}</h1>
        <p className="mt-4 text-[14px] leading-[1.5] text-ink">{area.description}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Chip>{plural(view.total, 'persona', 'personas')}</Chip>
          <Chip>{plural(subs.length, 'subárea', 'subáreas')}</Chip>
          {leader && <Chip>Líder área · {leader.name}</Chip>}
        </div>
      </Card>

      {leader && (
        <Card className="p-6">
          <h2 className="mb-4 text-[18px] font-semibold text-ink">Líder de área</h2>
          <PersonRow p={leader} me={leader.id === user.id} />
        </Card>
      )}

      {sections.map((s) => (
        <Card key={s.id} className="p-6">
          <h2 className="mb-4 text-[18px] font-semibold text-ink">{s.name}</h2>
          <div className="space-y-4">{s.list.map((p) => <PersonRow key={p.id} p={p} me={p.id === user.id} />)}</div>
        </Card>
      ))}
      {!sections.length && !leader && <EmptyState title="Tu área aún no tiene más integrantes" />}
    </div>
  );
}
