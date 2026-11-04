// Utilidades compartidas sobre personas: niveles, permisos y datos públicos.
const LEVELS = {
  colaborador:   { label: 'Colaborador',   perms: ['tasks', 'docs'] },
  lider:         { label: 'Líder',         perms: ['tasks', 'docs', 'posts'] },
  responsable:   { label: 'Responsable',   perms: ['tasks', 'docs', 'posts'] },
  administrador: { label: 'Administrador', perms: ['tasks', 'docs', 'posts', 'admin'] },
};
const PERMS = ['tasks', 'docs', 'posts', 'admin'];

const strip = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const fullName = (u) => [u.first_name, u.second_name, u.last_name, u.second_last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

// yalopezb = Yeison + Andres + López + Burbano
const baseUsername = (u) => strip(`${u.first_name[0] || ''}${u.second_name?.[0] || ''}${u.last_name}${u.second_last_name?.[0] || ''}`) || 'usuario';

module.exports = { LEVELS, PERMS, fullName, baseUsername, strip };
