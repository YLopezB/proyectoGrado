const clean = (s) => s.replace(/\./g, '');

export function formatBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0).replace('.', ',')} ${units[i]}`;
}

// 'AAAA-MM-DD' (sin zona horaria) -> "9 oct 2026"
export function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return clean(new Date(y, m - 1, day).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }));
}
export function formatLongDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}
// timestamp -> "7 oct 2026, 09:00"
export const formatDateTime = (iso) =>
  iso ? clean(new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })) : '—';
export const formatTime = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });

// "Miércoles, 7 de octubre de 2026"
export function todayLabel() {
  const s = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function timeAgo(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'Justo ahora';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `Hace ${d} ${d === 1 ? 'día' : 'días'}`;
  return formatDate(iso.slice(0, 10));
}

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const firstName = (name = '') => name.split(/\s+/)[0] || '';

export const KIND_LABEL = { asignada: 'Asignada', autoasignada: 'Autoasignada', solicitud: 'Solicitud', delegada: 'Delegada' };
export const PERM_LABEL = {
  tasks: 'Gestionar tareas y solicitudes',
  docs: 'Consultar y subir documentos',
  posts: 'Crear publicaciones y moderar comentarios',
  admin: 'Administrar usuarios, áreas, cargos y permisos',
};
export const LEVELS = [
  { value: 'colaborador', label: 'Colaborador', hint: 'Gestiona sus tareas y consulta documentos.' },
  { value: 'lider', label: 'Líder', hint: 'Además publica y modera comentarios.' },
  { value: 'responsable', label: 'Responsable', hint: 'Responsable de un área, con publicaciones.' },
  { value: 'administrador', label: 'Administrador', hint: 'Administra personas, áreas, cargos y permisos.' },
];
export const LEVEL_PERMS = {
  colaborador: ['tasks', 'docs'], lider: ['tasks', 'docs', 'posts'], responsable: ['tasks', 'docs', 'posts'],
  administrador: ['tasks', 'docs', 'posts', 'admin'],
};
export const fileExt = (name = '') => (name.includes('.') ? name.split('.').pop().toUpperCase() : 'ARCHIVO');
