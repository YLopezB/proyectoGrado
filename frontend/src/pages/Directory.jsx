import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDirectory } from '../hooks/useDirectory.js';
import { Avatar, Button, Card, EmptyState, FullSpinner, Select, cx } from '../components/ui.jsx';
import { openCreateTask } from '../lib/events.js';

function PersonCard({ p, me }) {
  const chat = useChat();
  const online = chat.isOnline(p.id);
  return (
    <div className="rounded-xl border border-line bg-tint px-[14px] py-[14px]">
      <p className="text-[11px] font-medium uppercase leading-[1.5] text-brand">{p.position_name || 'Sin cargo'}</p>
      <div className="mt-2.5 flex items-center gap-3">
        <div className="relative">
          <Avatar fileId={p.photo_file_id} name={p.name} size={40} />
          <span className={cx('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-tint', online ? 'bg-ok' : 'bg-line')} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold leading-[1.4] text-ink">{p.name}{me ? ' (Tú)' : ''}</p>
          <p className="text-[12px] leading-[1.5] text-muted">{online ? 'Disponible · En línea' : 'Sin conexión'}</p>
        </div>
      </div>
      {!me && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className="px-3.5 py-2.5" onClick={() => chat.openChat(p)}>Chat</Button>
          <Button size="sm" variant="secondary" className="px-3.5 py-2.5" onClick={() => openCreateTask(p)}>Tarea</Button>
        </div>
      )}
    </div>
  );
}

export default function Directory() {
  const { user } = useAuth();
  const { people, loading } = useDirectory();
  const [areaId, setAreaId] = useState('');
  const [openSet, setOpenSet] = useState(null); // null = solo el primer grupo

  const groups = useMemo(() => {
    const map = new Map();
    people.filter((p) => !areaId || String(p.area_id) === areaId).forEach((p) => {
      const k = p.area_id || 0;
      if (!map.has(k)) map.set(k, { id: k, name: p.area_name || 'Sin área', list: [] });
      map.get(k).list.push(p);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [people, areaId]);
  const areas = useMemo(() => {
    const m = new Map();
    people.forEach((p) => p.area_id && m.set(p.area_id, p.area_name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [people]);

  const isOpen = (g, i) => (openSet ? openSet.has(g.id) : i === 0 || groups.length === 1);
  const toggle = (g) => setOpenSet((s) => {
    const base = s || new Set(groups.filter((x, i) => isOpen(x, i)).map((x) => x.id));
    const n = new Set(base); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n;
  });

  return (
    <div className="max-w-[1112px]">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[38px]">Conecta con personal de la empresa</h1>
        <p className="mt-1 text-[14px] leading-[1.5] text-muted">Encuentra a la persona indicada que buscas. Inicia una conversación o desígnale una tarea.</p>
      </div>
      <Card className="p-5 sm:p-[19px]">
        <h2 className="mb-5 mt-1 text-[20px] font-semibold text-ink">Directorio</h2>
        <Select label="Filtrar por área" value={areaId} onChange={(e) => { setAreaId(e.target.value); setOpenSet(null); }}>
          <option value="">Todas las áreas</option>
          {areas.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </Select>
        <div className="mt-5">
          {loading ? <FullSpinner /> : groups.length === 0 ? <EmptyState title="No hay personas para mostrar" /> : groups.map((g, i) => {
            const open = isOpen(g, i);
            return (
              <section key={g.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => toggle(g)} aria-expanded={open} className="flex w-full items-center gap-1.5 py-3.5 text-left text-[12.5px] text-ink">
                  {open ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
                  <span className={cx(open && 'font-semibold')}>{g.name} · {g.list.length} {g.list.length === 1 ? 'persona' : 'personas'}</span>
                </button>
                {open && <div className="grid gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3">{g.list.map((p) => <PersonCard key={p.id} p={p} me={p.id === user.id} />)}</div>}
              </section>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
