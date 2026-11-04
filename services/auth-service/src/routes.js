const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query } = require('shared/db');
const { HttpError, asyncHandler } = require('shared/errors');
const { sign, authenticate, adminPasswordVersion, safeEqual, ALL_PERMS } = require('shared/auth');
const { LEVELS } = require('shared/people');

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10); // evita diferencias de tiempo si el usuario no existe

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 30), // intentos FALLIDOS por IP cada 15 min
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
});

const adminUser = () => ({
  id: 'admin', role: 'admin', name: 'Administrador', username: ADMIN_USER, document: ADMIN_USER,
  title: 'Administrador de sistema', perms: ALL_PERMS, level: 'administrador', levelLabel: 'Administrador',
  mustChange: false, photoFileId: null, areaId: null, area: null, position: null,
});

const USER_SQL = `SELECT u.*, a.name AS area_name, p.name AS position_name
                  FROM users u LEFT JOIN areas a ON a.id = u.area_id LEFT JOIN positions p ON p.id = u.position_id`;

const publicUser = (u) => ({
  id: u.id, role: 'user', name: u.name, username: u.username, document: u.document, email: u.email,
  title: [u.position_name, u.area_name].filter(Boolean).join(' · ') || 'Colaborador',
  level: u.level, levelLabel: LEVELS[u.level]?.label || u.level, perms: u.permissions || [],
  mustChange: u.must_change_password, photoFileId: u.photo_file_id,
  areaId: u.area_id, area: u.area_name, position: u.position_name,
});
const tokenFor = (u) => sign({ sub: String(u.id), role: u.role, name: u.name, mcp: !!u.mustChange });
const adminTokenFor = async (u) => sign({ sub: 'admin', role: 'admin', name: u.name, pv: await adminPasswordVersion() });

// Contraseña del administrador: la guardada en la base de datos (si la cambió desde la plataforma)
// o, si no hay ninguna, ADMIN_PASSWORD del .env.
async function checkAdminPassword(password) {
  const { rows } = await query('SELECT password_hash FROM admin_account WHERE id = 1');
  if (rows[0]) return bcrypt.compare(password, rows[0].password_hash);
  await bcrypt.compare(password, DUMMY_HASH); // tiempo de respuesta similar en ambos casos
  return safeEqual(password, ADMIN_PASSWORD);
}

// POST /api/auth/login  { identifier, password }   identifier = usuario (ej. yalopezb) o documento
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { identifier, password } = req.body || {};
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) {
    throw new HttpError(400, 'Usuario y contraseña son obligatorios');
  }
  const id = identifier.trim();

  // Administrador: usuario del .env; contraseña de la base de datos o, en su defecto, del .env
  if (id.toLowerCase() === ADMIN_USER.toLowerCase()) {
    if (!(await checkAdminPassword(password))) throw new HttpError(401, 'Credenciales inválidas');
    const user = adminUser();
    return res.json({ token: await adminTokenFor(user), user });
  }

  // Persona: usuario (nombre de usuario) o número de documento
  const { rows } = await query(`${USER_SQL} WHERE lower(u.username) = lower($1) OR u.document = $1 LIMIT 1`, [id]);
  const u = rows[0];
  const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok) throw new HttpError(401, 'Credenciales inválidas');
  if (!u.active) throw new HttpError(403, 'Tu usuario está desactivado. Contacta al administrador.');
  const user = publicUser(u);
  res.json({ token: tokenFor(user), user });
}));

// GET /api/auth/me  (permite sesión con cambio de contraseña pendiente)
router.get('/me', authenticate({ allowMustChange: true }), asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') return res.json({ user: adminUser() });
  const { rows } = await query(`${USER_SQL} WHERE u.id = $1`, [req.user.id]);
  res.json({ user: publicUser(rows[0]) });
}));

// Política de contraseñas (la misma que muestra el formulario del frontend)
function validatePassword(pw, { current, document, username }) {
  if (pw.length < 12) return 'La nueva contraseña debe tener al menos 12 caracteres';
  if (pw.length > 72) return 'La nueva contraseña no puede superar 72 caracteres';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) return 'Debe incluir una mayúscula y una minúscula';
  if (!/\d/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) return 'Debe incluir un número y un símbolo';
  if (pw === current) return 'La nueva contraseña debe ser distinta de la actual';
  if (document && pw === document) return 'La contraseña no puede ser tu número de documento';
  if (username && pw.toLowerCase() === username.toLowerCase()) return 'La contraseña no puede ser tu nombre de usuario';
  return null;
}

// POST /api/auth/change-password  { currentPassword, newPassword }
router.post('/change-password', authenticate({ allowMustChange: true }), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    throw new HttpError(400, 'Contraseña actual y nueva son obligatorias');
  }

  // Administrador: se guarda el hash en admin_account (tiene prioridad sobre ADMIN_PASSWORD del .env).
  // El token nuevo lleva la nueva versión, así que las demás sesiones del administrador se cierran.
  if (req.user.role === 'admin') {
    if (!(await checkAdminPassword(currentPassword))) throw new HttpError(400, 'La contraseña actual es incorrecta');
    const problem = validatePassword(newPassword, { current: currentPassword, username: ADMIN_USER });
    if (problem) throw new HttpError(400, problem);
    const hash = await bcrypt.hash(newPassword, 10);
    await query(
      `INSERT INTO admin_account (id, password_hash, updated_at) VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()`,
      [hash],
    );
    const user = adminUser();
    return res.json({ token: await adminTokenFor(user), user });
  }

  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const u = rows[0];
  if (!(await bcrypt.compare(currentPassword, u.password_hash))) throw new HttpError(400, 'La contraseña actual es incorrecta');
  const problem = validatePassword(newPassword, { current: currentPassword, document: u.document });
  if (problem) throw new HttpError(400, problem);

  const hash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = now() WHERE id = $2', [hash, u.id]);
  const full = await query(`${USER_SQL} WHERE u.id = $1`, [u.id]);
  const user = publicUser(full.rows[0]);
  res.json({ token: tokenFor(user), user });
}));

module.exports = router;
