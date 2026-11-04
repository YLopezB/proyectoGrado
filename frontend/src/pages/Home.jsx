import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, ListChecks, Users } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCompany } from '../context/CompanyContext.jsx';
import { useDirectory } from '../hooks/useDirectory.js';
import { Button, Card, EmptyState, FullSpinner } from '../components/ui.jsx';
import PostCard from '../components/PostCard.jsx';
import { TASKS_EVENT } from '../lib/events.js';
import { firstName } from '../lib/format.js';

function Stat({ icon: Icon, value, label }) {
  return (
    <Card className="flex items-center gap-4 px-5 py-[18px]">
      <Icon className="h-[22px] w-[22px] shrink-0 text-brand" strokeWidth={1.5} />
      <span className="text-[28px] font-semibold leading-none text-ink">{value}</span>
      <span className="text-[12px] text-muted">{label}</span>
    </Card>
  );
}

export default function Home() {
  const { user } = useAuth();
  const company = useCompany();
  const { people } = useDirectory();
  const [stats, setStats] = useState({ pending: 0, done: 0 });
  const [posts, setPosts] = useState(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const load = () => api.get('/tasks/stats').then(setStats).catch(() => {});
    load();
    window.addEventListener(TASKS_EVENT, load);
    return () => window.removeEventListener(TASKS_EVENT, load);
  }, []);
  useEffect(() => { api.get('/posts?limit=10').then((p) => { setPosts(p); setMore(p.length === 10); }).catch(() => setPosts([])); }, []);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const next = await api.get(`/posts?limit=10&before=${posts[posts.length - 1].id}`);
      setPosts((l) => [...l, ...next]); setMore(next.length === 10);
    } finally { setLoadingMore(false); }
  }, [posts]);

  const inArea = people.filter((p) => user.areaId && p.area_id === user.areaId).length;
  const update = (np) => setPosts((l) => l.map((p) => (p.id === np.id ? np : p)));

  return (
    <div className="mx-auto max-w-[1112px] lg:mx-0">
      <p className="text-[10px] font-semibold uppercase leading-[1.6] text-brand">Tu espacio de trabajo</p>
      <h1 className="mt-2 text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[36px]">Hola, {firstName(user.name)}. Bienvenido de vuelta.</h1>
      <p className="mt-1.5 text-[14px] leading-[1.5] text-muted">Explora las novedades y mantente conectado con todo lo que sucede en <strong className="font-semibold text-ink">{company.name}</strong></p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat icon={ListChecks} value={stats.pending} label="Tareas pendientes" />
        <Stat icon={CheckCheck} value={stats.done} label="Tareas realizadas" />
        <Stat icon={Users} value={inArea} label="Personas en tu área" />
      </div>

      <div className="mt-6 space-y-6">
        {posts === null ? <FullSpinner /> : posts.length === 0 ? (
          <EmptyState title="Aún no hay publicaciones">Cuando alguien comparta una novedad de la empresa, la verás aquí.</EmptyState>
        ) : posts.map((p) => <PostCard key={p.id} post={p} onChange={update} onDeleted={(x) => setPosts((l) => l.filter((q) => q.id !== x.id))} />)}
        {more && <div className="text-center"><Button variant="secondary" onClick={loadMore} loading={loadingMore}>Ver publicaciones anteriores</Button></div>}
      </div>
    </div>
  );
}
