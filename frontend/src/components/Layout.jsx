import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ExternalLink, MessageSquare, X } from 'lucide-react';
import { can, useAuth } from '../context/AuthContext.jsx';
import { useCompany } from '../context/CompanyContext.jsx';
import { ChatProvider, useChat } from '../context/ChatContext.jsx';
import { api } from '../api/client.js';
import { Avatar, cx } from './ui.jsx';
import { formatDate, timeAgo, todayLabel } from '../lib/format.js';
import { TASKS_EVENT } from '../lib/events.js';
import ChatModal from '../modals/ChatModal.jsx';
import { TaskModalHost } from '../modals/TaskModals.jsx';

/* ------------------------------ Navegación ------------------------------ */

function usePendingCount(enabled) {
  const [n, setN] = useState(0);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!enabled) return undefined;
    const load = () => api.get('/tasks/stats').then((s) => setN(s.pending)).catch(() => {});
    load();
    window.addEventListener(TASKS_EVENT, load);
    return () => window.removeEventListener(TASKS_EVENT, load);
  }, [enabled, pathname]);
  return n;
}

const ADMIN_ITEMS = [
  { to: '/admin/usuarios', label: 'Usuarios y permisos' },
  { to: '/admin/areas', label: 'Áreas y cargos', match: ['/admin/areas', '/admin/cargos'] },
  { to: '/admin/publicaciones', label: 'Publicaciones', match: ['/admin/publicaciones'] },
  { to: '/admin/organigrama', label: 'Organigrama' },
  { to: '/admin/empresa', label: 'Empresa' },
];

function buildNav(user, pending) {
  const person = user.role === 'user';
  const groups = [];
  if (person) {
    groups.push({
      items: [
        { to: '/', label: 'Inicio', end: true },
        { to: '/area', label: 'Área' },
        { to: '/tareas', label: 'Mis tareas', count: pending, end: true },
        { to: '/tareas/realizadas', label: 'Tareas realizadas' },
        { to: '/tareas/asignadas', label: 'Tareas asignadas' },
        { to: '/repositorio', label: 'Repositorio' },
        { to: '/directorio', label: 'Directorio' },
      ],
    });
  }
  if (can(user, 'admin')) {
    const items = [...ADMIN_ITEMS];
    if (!person) items.push({ to: '/admin/clave', label: 'Contraseña' });
    groups.push({ title: 'Administración', items });
  } else if (can(user, 'posts')) {
    groups.push({ title: 'Gestión', items: [ADMIN_ITEMS[2]] });
  }
  return groups;
}

function NavItem({ item, onClick }) {
  const { pathname } = useLocation();
  const forced = item.match?.some((m) => pathname.startsWith(m));
  return (
    <NavLink to={item.to} end={item.end} onClick={onClick}
      className={({ isActive }) => cx('flex items-center gap-[11px] py-[10.5px] text-[14px] leading-[1.45]', (isActive || forced) ? 'font-semibold text-brand' : 'text-muted hover:text-ink')}>
      {({ isActive }) => (
        <>
          {(isActive || forced) && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
          <span>{item.label}{item.count > 0 ? <span className="ml-1.5">· {item.count}</span> : null}</span>
        </>
      )}
    </NavLink>
  );
}

function Brand() {
  const c = useCompany();
  return (
    <div className="px-6 pt-[26px]">
      <img src={c.logoUrl} alt="" className="h-[40px] w-auto max-w-[190px] object-contain object-left" />
      <p className="mt-[22px] text-[14px] font-semibold leading-[1.45] text-ink">{c.name}</p>
      <p className="mt-0.5 text-[11px] leading-[1.45] text-muted">{c.slogan}</p>
    </div>
  );
}

function ExternalLinkRow({ href, children, className }) {
  if (!href) return <span className={className}>{children}</span>;
  return <a href={href} target="_blank" rel="noreferrer noopener" className={cx('inline-flex items-center gap-1.5', className)}>{children}<ExternalLink className="h-3 w-3" strokeWidth={1.75} /></a>;
}

function Sidebar({ user, logout, pending }) {
  const c = useCompany();
  const groups = buildNav(user, pending);
  return (
    <aside className="no-print fixed inset-y-0  z-30 hidden w-[248px] flex-col overflow-y-auto border-r border-line bg-white lg:flex">
      <Brand />
      <nav className="mt-9 px-6" aria-label="Principal">
        {groups.map((g, i) => (
          <div key={i} className={cx(i > 0 && 'mt-5')}>
            {g.title && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{g.title}</p>}
            {g.items.map((it) => <NavItem key={it.to} item={it} />)}
          </div>
        ))}
      </nav>
      <div className="mt-auto px-6 pb-8 pt-8">
        <div className="border-t border-line pt-5">
          {c.helpUrl && <ExternalLinkRow href={c.helpUrl} className="py-2 text-[13px] text-brand">Centro de ayuda</ExternalLinkRow>}
          <button type="button" onClick={logout} className="block py-2 text-[13px] text-muted hover:text-ink">Cerrar sesión</button>
        </div>
        <div className="mt-3 border-t border-line pt-5 text-center text-[12px] text-muted">
          <p className="text-left text-[13px]">Desarrollado por:</p>
          <p className="mt-3 text-[12.5px]"><ExternalLinkRow href={c.developerUrl} className="text-brand">{c.developerName}</ExternalLinkRow></p>
          <p className="mt-3">© {new Date().getFullYear()} {c.developerName}</p>
          <p className="mt-3">Versión: {c.appVersion}</p>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------ Cabecera ------------------------------ */
function useOutside(ref, onOut, active) {
  useEffect(() => {
    if (!active) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    const k = (e) => e.key === 'Escape' && onOut();
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [ref, onOut, active]);
}

function Popover({ open, onClose, children, label }) {
  const ref = useRef(null);
  useOutside(ref, onClose, open);
  if (!open) return null;
  return (
    <div ref={ref} role="dialog" aria-label={label} className="anim-pop absolute right-0 top-[calc(100%+10px)] z-40 w-[320px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_20px_50px_-15px_rgba(32,51,56,.3)]">
      {children}
    </div>
  );
}

function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const nav = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => { api.get('/tasks/notifications').then(setItems).catch(() => {}); }, [pathname, open]);
  const count = items.length;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Notificaciones" className="relative rounded-lg p-2 text-brand hover:bg-tint">
        <Bell className="h-[22px] w-[22px]" strokeWidth={1.5} />
        {count > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand" />}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} label="Notificaciones">
        <p className="border-b border-line px-4 py-3 text-[13px] font-semibold">Notificaciones</p>
        {items.length === 0 ? <p className="px-4 py-6 text-center text-[13px] text-muted">No tienes notificaciones de tareas.</p> : (
          <ul className="max-h-[360px] overflow-y-auto">
            {items.map((t) => (
              <li key={t.id}>
                {t.type === 'done' ? (
                  <button type="button" onClick={() => { setOpen(false); nav('/tareas/asignadas?estado=realizadas'); }} className="block w-full border-b border-line px-4 py-3 text-left last:border-0 hover:bg-tint">
                    <p className="text-[11px] font-semibold text-ok">Tarea realizada</p>
                    <p className="text-[13px] font-semibold text-ink">{t.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{t.assignee_name}{t.completion_file_id ? ' · con documento' : ''} · {timeAgo(t.completed_at)}</p>
                  </button>
                ) : (
                  <button type="button" onClick={() => { setOpen(false); nav('/tareas'); }} className="block w-full border-b border-line px-4 py-3 text-left last:border-0 hover:bg-tint">
                    <p className="text-[13px] font-semibold text-ink">{t.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{t.creator_name} · entrega {formatDate(t.due_date)} · {timeAgo(t.created_at)}</p>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </div>
  );
}

function ChatButton() {
  const [open, setOpen] = useState(false);
  const chat = useChat();
  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); chat.loadConversations(); }} aria-label="Mensajes" className="relative rounded-lg p-2 text-brand hover:bg-tint">
        <MessageSquare className="h-[22px] w-[22px]" strokeWidth={1.5} />
        {chat.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-brand px-1 text-[10px] font-semibold text-white">{chat.unread > 9 ? '9+' : chat.unread}</span>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} label="Conversaciones">
        <p className="border-b border-line px-4 py-3 text-[13px] font-semibold">Mensajes</p>
        {chat.conversations.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-muted">Aún no tienes conversaciones. Inicia una desde el <Link to="/directorio" onClick={() => setOpen(false)} className="font-semibold text-brand">Directorio</Link>.</p>
        ) : (
          <ul className="max-h-[360px] overflow-y-auto">
            {chat.conversations.map((c) => (
              <li key={c.key}>
                <button type="button" onClick={() => { setOpen(false); chat.openChat({ id: Number(c.key), name: c.name, photo_file_id: c.photo_file_id, position_name: c.position_name }); }}
                  className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-tint">
                  <Avatar fileId={c.photo_file_id} name={c.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{c.name}</span>
                    <span className={cx('block truncate text-[12px]', c.unread ? 'font-semibold text-ink' : 'text-muted')}>{c.last_sender === String(c.key) ? '' : 'Tú: '}{c.last_content}</span>
                  </span>
                  {c.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </div>
  );
}

function Header({ user }) {
  const person = user.role === 'user';
  return (
    <header className="no-print sticky top-0 z-20 flex h-[78px] items-center border-b border-line bg-white px-5 sm:px-8 lg:h-[88px] lg:px-10">
      {person ? (
        <Link to="/perfil" className="flex min-w-0 items-center gap-3.5 rounded-lg" aria-label="Mi perfil">
          <Avatar fileId={user.photoFileId} name={user.name} size={44} />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold leading-[1.4] text-ink">{user.name}</span>
            <span className="block truncate text-[12px] leading-[1.4] text-muted">{user.title}</span>
          </span>
        </Link>
      ) : (
        <div className="flex min-w-0 items-center gap-3.5">
          <Avatar name="" dark size={36} />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold leading-[1.4] text-ink">{user.name}</span>
            <span className="block truncate text-[12px] leading-[1.4] text-muted">{user.title}</span>
          </span>
        </div>
      )}
      {person && (
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <span className="mr-1 hidden text-[12px] text-muted md:block">{todayLabel()}</span>
          <NotificationsButton />
          <ChatButton />
        </div>
      )}
    </header>
  );
}

/* ------------------------------ Navegación móvil ------------------------------ */
function MobileNav({ user, logout, pending }) {
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();
  const c = useCompany();
  useEffect(() => setMore(false), [pathname]);
  const person = user.role === 'user';
  const main = person
    ? [{ to: '/', label: 'Inicio', end: true }, { to: '/tareas', label: 'Tareas', match: ['/tareas'] }, { to: '/repositorio', label: 'Repositorio' }, { to: '/directorio', label: 'Directorio' }]
    : [{ to: '/admin/usuarios', label: 'Usuarios' }, { to: '/admin/areas', label: 'Áreas', match: ['/admin/areas', '/admin/cargos'] }, { to: '/admin/publicaciones', label: 'Publicaciones' }, { to: '/admin/organigrama', label: 'Organigrama' }];
  const groups = buildNav(user, pending);
  const shown = new Set(main.map((m) => m.to));
  const extra = groups.flatMap((g) => g.items).filter((i) => !shown.has(i.to));
  if (person) extra.push({ to: '/perfil', label: 'Mi perfil' });
  return (
    <>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex h-[60px] border-t border-line bg-white lg:hidden" aria-label="Principal">
        {main.map((m) => {
          const active = m.match ? m.match.some((p) => pathname.startsWith(p)) : m.end ? pathname === m.to : pathname.startsWith(m.to);
          return (
            <Link key={m.to} to={m.to} aria-current={active ? 'page' : undefined}
              className={cx('flex flex-1 items-center justify-center text-[12px]', active ? 'font-semibold text-brand' : 'text-muted')}>{m.label}</Link>
          );
        })}
        <button type="button" onClick={() => setMore(true)} className="flex flex-1 items-center justify-center text-[12px] text-muted">Más</button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 flex items-end anim-fade lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMore(false)} aria-hidden="true" />
          <div role="dialog" aria-label="Más opciones" className="anim-sheet relative max-h-[85dvh] w-full overflow-y-auto rounded-t-[24px] bg-white px-6 pb-8 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[18px] font-semibold">Más opciones</p>
              <button type="button" onClick={() => setMore(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-brand"><X className="h-5 w-5" /></button>
            </div>
            <ul>
              {extra.map((i) => (
                <li key={i.to}><Link to={i.to} className="block border-b border-line py-3.5 text-[15px] text-ink">{i.label}{i.count > 0 ? ` · ${i.count}` : ''}</Link></li>
              ))}
              {c.helpUrl && <li><a href={c.helpUrl} target="_blank" rel="noreferrer noopener" className="block border-b border-line py-3.5 text-[15px] text-brand">Centro de ayuda ↗</a></li>}
              <li><button type="button" onClick={logout} className="block w-full py-3.5 text-left text-[15px] text-muted">Cerrar sesión</button></li>
            </ul>
            <p className="mt-4 text-center text-[11px] text-muted">{c.name} · Versión {c.appVersion}</p>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------ Estructura general ------------------------------ */
function Shell() {
  const { user, logout } = useAuth();
  const pending = usePendingCount(user.role === 'user');
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="min-h-screen bg-page mx-auto max-w-[1440px]">
      <Sidebar user={user} logout={logout} pending={pending} />
      <div className="lg:pl-[248px]">
        <Header user={user} />
        <main className="px-5 pb-[88px] pt-6 sm:px-8 lg:px-10 lg:pb-14 lg:pt-10">
          <Outlet />
        </main>
      </div>
      <MobileNav user={user} logout={logout} pending={pending} />
      {user.role === 'user' && (<><ChatModal /><TaskModalHost /></>)}
    </div>
  );
}

export default function AppLayout() {
  return (
    <ChatProvider>
      <Shell />
    </ChatProvider>
  );
}
