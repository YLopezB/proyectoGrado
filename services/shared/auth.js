const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { HttpError } = require('./errors');
const { query } = require('./db');

const ALL_PERMS = ['tasks', 'docs', 'posts', 'admin'];

/**
 * Versión de la contraseña del administrador (marca de tiempo del último cambio, 0 = la del .env).
 * Va en su token como `pv`; al cambiar la contraseña, las sesiones anteriores dejan de ser válidas.
 */
async function adminPasswordVersion() {
  try {
    const { rows } = await query('SELECT updated_at FROM admin_account WHERE id = 1');
    return rows[0] ? rows[0].updated_at.getTime() : 0;
  } catch (e) {
    if (e.code === '42P01') return 0; // la tabla aún no existe (auth-service la crea al iniciar)
    throw e;
  }
}

const sign = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

/**
 * Valida el JWT y recarga a la persona desde la base de datos en cada petición, de modo que
 * desactivar a un usuario o quitarle permisos surte efecto de inmediato.
 *
 * req.user = { key, id, role: 'admin'|'user', name, perms[], areaId, positionId, mustChange }
 * El administrador del .env (role 'admin') tiene todos los permisos.
 * Mientras la persona deba cambiar su contraseña, TODAS las rutas responden 403
 * PASSWORD_CHANGE_REQUIRED salvo las que usen { allowMustChange: true }.
 */
function authenticate({ allowMustChange = false } = {}) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) throw new HttpError(401, 'No autenticado');
      let p;
      try {
        p = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        throw new HttpError(401, 'Sesión inválida o expirada');
      }
      if (p.role === 'admin') {
        if ((p.pv || 0) !== (await adminPasswordVersion())) throw new HttpError(401, 'Sesión inválida o expirada');
        req.user = { key: 'admin', id: null, role: 'admin', name: p.name, perms: ALL_PERMS, areaId: null, positionId: null, mustChange: false };
      } else {
        const { rows } = await query(
          'SELECT id, name, active, must_change_password, permissions, area_id, position_id FROM users WHERE id = $1',
          [Number(p.sub)],
        );
        const u = rows[0];
        if (!u || !u.active) throw new HttpError(401, 'Sesión inválida o usuario desactivado');
        req.user = {
          key: String(u.id), id: u.id, role: 'user', name: u.name, perms: u.permissions || [],
          areaId: u.area_id, positionId: u.position_id, mustChange: u.must_change_password,
        };
      }
      if (req.user.mustChange && !allowMustChange) {
        throw new HttpError(403, 'Debes cambiar tu contraseña', 'PASSWORD_CHANGE_REQUIRED');
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

const can = (user, perm) => user.role === 'admin' || user.perms.includes(perm);

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'No tienes permisos para esta acción'));

// requirePerm('admin') | requirePerm('posts') ...
const requirePerm = (perm) => (req, res, next) =>
  req.user && can(req.user, perm) ? next() : next(new HttpError(403, 'No tienes permisos para esta acción'));

// Solo personas (no la cuenta de administrador del .env): tareas, chat, perfil...
const requirePerson = (req, res, next) =>
  req.user?.id ? next() : next(new HttpError(403, 'Esta función es solo para usuarios de la plataforma'));

const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// Protege los endpoints /internal (solo comunicación entre microservicios)
const internalOnly = (req, res, next) => {
  const key = req.headers['x-internal-key'];
  if (!process.env.INTERNAL_API_KEY || !key || !safeEqual(key, process.env.INTERNAL_API_KEY)) {
    return next(new HttpError(403, 'Acceso interno denegado'));
  }
  next();
};

module.exports = { sign, authenticate, adminPasswordVersion, requireRole, requirePerm, requirePerson, can, safeEqual, internalOnly, ALL_PERMS };
