const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('shared/db');
const { HttpError, asyncHandler } = require('shared/errors');
const { authenticate, requirePerm, requirePerson } = require('shared/auth');
const { LEVELS, PERMS, fullName, baseUsername } = require('shared/people');

const REPOSITORY_URL = process.env.REPOSITORY_URL || 'http://repository-service:4004';

const SELECT = `SELECT u.id, u.username, u.document, u.first_name, u.second_name, u.last_name, u.second_last_name, u.name,
    u.email, u.phone, to_char(u.hire_date,'YYYY-MM-DD') AS hire_date, to_char(u.birth_date,'YYYY-MM-DD') AS birth_date,
    u.area_id, u.position_id, u.level, u.permissions, u.photo_file_id, u.active, u.must_change_password,
    u.emergency_name, u.emergency_phone, u.personal_email, u.personal_phone, u.created_at,
    a.name AS area_name, p.name AS position_name
  FROM users u LEFT JOIN areas a ON a.id = u.area_id LEFT JOIN positions p ON p.id = u.position_id`;

const find = async (id) => (await query(`${SELECT} WHERE u.id = $1`, [id])).rows[0];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const text = (v, max, label, { required = false } = {}) => {
  const s = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (required && !s) throw new HttpError(400, `${label} es obligatorio`);
  if (s.length > max) throw new HttpError(400, `${label} es demasiado largo`);
  return s || null;
};

/* ---------------------------------------------------------------------------------------
 *  Rutas para cualquier persona autenticada
 * ------------------------------------------------------------------------------------- */
router.get('/directory', authenticate(), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.username, u.area_id, u.position_id, u.level, u.photo_file_id, u.phone, u.email,
            a.name AS area_name, p.name AS position_name
     FROM users u LEFT JOIN areas a ON a.id = u.area_id LEFT JOIN positions p ON p.id = u.position_id
     WHERE u.active ORDER BY u.name`);
  res.json(rows);
}));

// Mi perfil
router.get('/me', authenticate(), requirePerson, asyncHandler(async (req, res) => {
  res.json(await find(req.user.id));
}));

router.put('/me', authenticate(), requirePerson, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const email = text(b.personal_email, 160, 'El correo personal');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Correo personal inválido');
  await query(
    `UPDATE users SET emergency_name = $1, emergency_phone = $2, personal_email = $3, personal_phone = $4, updated_at = now() WHERE id = $5`,
    [text(b.emergency_name, 120, 'El nombre de contacto'), text(b.emergency_phone, 30, 'El teléfono de contacto'),
      email, text(b.personal_phone, 30, 'El teléfono personal'), req.user.id],
  );
  res.json(await find(req.user.id));
}));

/* ---------------------------------------------------------------------------------------
 *  Administración de personas (permiso "admin")
 * ------------------------------------------------------------------------------------- */
const admin = [authenticate(), requirePerm('admin')];

async function parsePerson(b, { partial = false, existing } = {}) {
  const o = {};
  const has = (k) => !partial || b[k] !== undefined;
  if (has('first_name')) o.first_name = text(b.first_name, 60, 'El primer nombre', { required: true });
  if (has('second_name')) o.second_name = text(b.second_name, 60, 'El segundo nombre');
  if (has('last_name')) o.last_name = text(b.last_name, 60, 'El primer apellido', { required: true });
  if (has('second_last_name')) o.second_last_name = text(b.second_last_name, 60, 'El segundo apellido');
  if (has('document')) {
    const doc = String(b.document ?? '').trim();
    if (!/^[A-Za-z0-9.\-]{4,30}$/.test(doc)) throw new HttpError(400, 'El documento debe tener entre 4 y 30 caracteres alfanuméricos (se permiten . y -)');
    if (doc.toLowerCase() === process.env.ADMIN_USER.toLowerCase()) throw new HttpError(400, 'Ese documento está reservado');
    o.document = doc;
  }
  if (has('phone')) o.phone = text(b.phone, 30, 'El teléfono', { required: !partial });
  for (const k of ['hire_date', 'birth_date']) {
    if (has(k)) {
      const v = String(b[k] ?? '').trim();
      if (!v && !partial) throw new HttpError(400, `${k === 'hire_date' ? 'La fecha de ingreso' : 'La fecha de nacimiento'} es obligatoria`);
      if (v && !isDate(v)) throw new HttpError(400, 'Fecha inválida (AAAA-MM-DD)');
      o[k] = v || null;
    }
  }
  if (b.email !== undefined) {
    const email = text(b.email, 160, 'El correo');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Correo electrónico inválido');
    o.email = email;
  }
  if (has('area_id') || has('position_id')) {
    const areaId = Number(b.area_id ?? existing?.area_id);
    const positionId = Number(b.position_id ?? existing?.position_id);
    if (!Number.isInteger(areaId)) throw new HttpError(400, 'El área es obligatoria');
    if (!Number.isInteger(positionId)) throw new HttpError(400, 'El cargo es obligatorio');
    const r = await query('SELECT 1 FROM positions WHERE id = $1 AND area_id = $2', [positionId, areaId]);
    if (!r.rowCount) throw new HttpError(400, 'El cargo seleccionado no pertenece al área');
    o.area_id = areaId;
    o.position_id = positionId;
  }
  return o;
}

const uniqueUsername = async (p, exceptId = 0) => {
  const base = baseUsername(p).slice(0, 30);
  for (let i = 0; i < 1000; i++) {
    const candidate = i === 0 ? base : `${base}${i + 1}`;
    const r = await query('SELECT 1 FROM users WHERE username = $1 AND id <> $2', [candidate, exceptId]);
    if (!r.rowCount) return candidate;
  }
  throw new HttpError(500, 'No se pudo generar el nombre de usuario');
};

const handleUnique = (e) => {
  if (e.code === '23505') throw new HttpError(409, 'Ya existe una persona con ese documento');
  throw e;
};

router.get('/stats', ...admin, asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active)::int AS active,
      COUNT(*) FILTER (WHERE NOT active)::int AS inactive FROM users`);
  res.json(rows[0]);
}));

router.get('/', ...admin, asyncHandler(async (req, res) => {
  const conds = []; const params = [];
  const q = String(req.query.q || '').trim();
  if (q) { params.push(`%${q}%`); conds.push(`(u.name ILIKE $${params.length} OR u.document ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
  if (/^\d+$/.test(req.query.areaId || '')) { params.push(Number(req.query.areaId)); conds.push(`u.area_id = $${params.length}`); }
  if (req.query.status === 'active') conds.push('u.active');
  if (req.query.status === 'inactive') conds.push('NOT u.active');
  const { rows } = await query(`${SELECT} ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY u.name`, params);
  res.json(rows);
}));

router.get('/:id(\\d+)', ...admin, asyncHandler(async (req, res) => {
  const u = await find(req.params.id);
  if (!u) throw new HttpError(404, 'Persona no encontrada');
  res.json(u);
}));

// POST /api/users -> la contraseña inicial es el número de documento (debe cambiarla al ingresar)
router.post('/', ...admin, asyncHandler(async (req, res) => {
  const d = await parsePerson(req.body || {});
  const hash = await bcrypt.hash(d.document, 10);
  const name = fullName(d);
  const username = await uniqueUsername(d);
  try {
    const { rows } = await query(
      `INSERT INTO users (username, document, first_name, second_name, last_name, second_last_name, name, email, phone,
                          hire_date, birth_date, area_id, position_id, password_hash, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE) RETURNING id`,
      [username, d.document, d.first_name, d.second_name, d.last_name, d.second_last_name, name, d.email ?? null, d.phone,
        d.hire_date, d.birth_date, d.area_id, d.position_id, hash],
    );
    res.status(201).json(await find(rows[0].id));
  } catch (e) { handleUnique(e); }
}));

// PUT /api/users/:id -> datos de la persona
router.put('/:id(\\d+)', ...admin, asyncHandler(async (req, res) => {
  const cur = await find(req.params.id);
  if (!cur) throw new HttpError(404, 'Persona no encontrada');
  const d = await parsePerson(req.body || {}, { partial: true, existing: cur });
  const merged = { ...cur, ...d };
  d.name = fullName(merged);
  if (d.first_name !== undefined || d.last_name !== undefined || d.second_name !== undefined || d.second_last_name !== undefined) {
    d.username = await uniqueUsername(merged, cur.id);
  }
  const fields = Object.keys(d);
  try {
    await query(
      `UPDATE users SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')}, updated_at = now() WHERE id = $${fields.length + 1}`,
      [...fields.map((f) => d[f]), cur.id],
    );
  } catch (e) { handleUnique(e); }
  // Si cambió de área, deja de ser responsable de áreas que ya no son suyas
  await query('UPDATE areas SET leader_id = NULL WHERE leader_id = $1 AND id <> COALESCE((SELECT area_id FROM users WHERE id = $1), 0)', [cur.id]);
  res.json(await find(cur.id));
}));

// PUT /api/users/:id/access  { level, permissions[], active }
router.put('/:id(\\d+)/access', ...admin, asyncHandler(async (req, res) => {
  const cur = await find(req.params.id);
  if (!cur) throw new HttpError(404, 'Persona no encontrada');
  const b = req.body || {};
  const level = b.level ?? cur.level;
  if (!LEVELS[level]) throw new HttpError(400, 'Nivel de acceso inválido');
  const perms = b.permissions ?? LEVELS[level].perms;
  if (!Array.isArray(perms) || perms.some((p) => !PERMS.includes(p))) throw new HttpError(400, 'Permisos inválidos');
  const active = b.active === undefined ? cur.active : !!b.active;
  await query('UPDATE users SET level = $1, permissions = $2, active = $3, updated_at = now() WHERE id = $4',
    [level, PERMS.filter((p) => perms.includes(p)), active, cur.id]);
  res.json(await find(cur.id));
}));

// POST /api/users/:id/reset-password -> vuelve a dejar el documento como contraseña
router.post('/:id(\\d+)/reset-password', ...admin, asyncHandler(async (req, res) => {
  const cur = await query('SELECT document FROM users WHERE id = $1', [req.params.id]);
  if (!cur.rows[0]) throw new HttpError(404, 'Persona no encontrada');
  const hash = await bcrypt.hash(cur.rows[0].document, 10);
  await query('UPDATE users SET password_hash = $1, must_change_password = TRUE, updated_at = now() WHERE id = $2', [hash, req.params.id]);
  res.json(await find(req.params.id));
}));

// DELETE /api/users/:id  (borra su foto y adjuntos de tareas; los documentos del repositorio se conservan)
router.delete('/:id(\\d+)', ...admin, asyncHandler(async (req, res) => {
  const cur = await query('SELECT id FROM users WHERE id = $1', [req.params.id]);
  if (!cur.rows[0]) throw new HttpError(404, 'Persona no encontrada');
  try {
    const r = await fetch(`${REPOSITORY_URL}/internal/users/${req.params.id}/files`, {
      method: 'DELETE',
      headers: { 'x-internal-key': process.env.INTERNAL_API_KEY },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    console.error('[user-service] no se pudieron borrar los archivos:', e.message);
    throw new HttpError(502, 'No se pudieron eliminar los archivos de la persona. Inténtalo de nuevo.');
  }
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
