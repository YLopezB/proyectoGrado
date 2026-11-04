const router = require('express').Router();
const { query } = require('shared/db');
const { HttpError, asyncHandler } = require('shared/errors');
const { authenticate, requirePerm } = require('shared/auth');

router.use(authenticate());

const SELECT = `SELECT a.id, a.name, a.description, a.parent_id, a.leader_id, a.active, a.created_at,
    pa.name AS parent_name, l.name AS leader_name, l.photo_file_id AS leader_photo, lp.name AS leader_position,
    (SELECT COUNT(*)::int FROM users u WHERE u.area_id = a.id AND u.active) AS people,
    (SELECT COUNT(*)::int FROM areas c WHERE c.parent_id = a.id) AS subareas,
    (SELECT COUNT(*)::int FROM positions p WHERE p.area_id = a.id) AS positions
  FROM areas a
  LEFT JOIN areas pa ON pa.id = a.parent_id
  LEFT JOIN users l ON l.id = a.leader_id
  LEFT JOIN positions lp ON lp.id = l.position_id`;

const find = async (id) => (await query(`${SELECT} WHERE a.id = $1`, [id])).rows[0];

router.get('/', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const { rows } = q
    ? await query(`${SELECT} WHERE a.name ILIKE $1 ORDER BY a.name`, [`%${q}%`])
    : await query(`${SELECT} ORDER BY a.name`);
  res.json(rows);
}));

router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
  const a = await find(req.params.id);
  if (!a) throw new HttpError(404, 'Área no encontrada');
  res.json(a);
}));

async function parse(b, id) {
  const name = String(b.name ?? '').trim();
  if (!name || name.length > 120) throw new HttpError(400, 'El nombre del área es obligatorio (máx. 120 caracteres)');
  const description = String(b.description ?? '').trim();
  if (!description) throw new HttpError(400, 'La descripción es obligatoria');

  // "Depende de": vacío / null = área de nivel superior
  let parentId = null;
  if (b.parent_id !== undefined && b.parent_id !== null && b.parent_id !== '') {
    parentId = Number(b.parent_id);
    if (!Number.isInteger(parentId) || !(await find(parentId))) throw new HttpError(400, 'El área de la que depende no existe');
    if (id) {
      // evita ciclos: el padre no puede ser el área misma ni uno de sus descendientes
      const { rows } = await query(
        `WITH RECURSIVE d AS (SELECT id FROM areas WHERE id = $1 UNION SELECT a.id FROM areas a JOIN d ON a.parent_id = d.id)
         SELECT 1 FROM d WHERE id = $2`, [id, parentId]);
      if (rows.length) throw new HttpError(400, 'Un área no puede depender de sí misma ni de una de sus subáreas');
    }
  }

  let leaderId = null;
  if (b.leader_id !== undefined && b.leader_id !== null && b.leader_id !== '') {
    leaderId = Number(b.leader_id);
    const r = await query('SELECT area_id FROM users WHERE id = $1 AND active', [leaderId]);
    if (!r.rowCount) throw new HttpError(400, 'La persona responsable no existe');
    if (!id || r.rows[0].area_id !== id) throw new HttpError(400, 'La persona responsable debe ser integrante del área');
  }
  return { name, description, parentId, leaderId, active: b.active === undefined ? true : !!b.active };
}

const dup = (e) => { if (e.code === '23505') throw new HttpError(409, 'Ya existe un área con ese nombre'); throw e; };

router.post('/', requirePerm('admin'), asyncHandler(async (req, res) => {
  const d = await parse(req.body || {}, null);
  try {
    const { rows } = await query(
      'INSERT INTO areas (name, description, parent_id, active) VALUES ($1,$2,$3,$4) RETURNING id',
      [d.name, d.description, d.parentId, d.active]);
    res.status(201).json(await find(rows[0].id));
  } catch (e) { dup(e); }
}));

router.put('/:id(\\d+)', requirePerm('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await find(id))) throw new HttpError(404, 'Área no encontrada');
  const d = await parse(req.body || {}, id);
  try {
    await query('UPDATE areas SET name=$1, description=$2, parent_id=$3, leader_id=$4, active=$5 WHERE id=$6',
      [d.name, d.description, d.parentId, d.leaderId, d.active, id]);
  } catch (e) { dup(e); }
  res.json(await find(id));
}));

router.delete('/:id(\\d+)', requirePerm('admin'), asyncHandler(async (req, res) => {
  const a = await find(req.params.id);
  if (!a) throw new HttpError(404, 'Área no encontrada');
  if (a.people) throw new HttpError(409, 'No se puede eliminar: el área tiene personas asignadas');
  if (a.subareas) throw new HttpError(409, 'No se puede eliminar: el área tiene subáreas');
  const f = await query("SELECT 1 FROM files WHERE context = 'repo' AND ((folder_kind='area' AND folder_id = $1) OR (folder_kind='position' AND folder_id IN (SELECT id FROM positions WHERE area_id = $1))) LIMIT 1", [a.id]);
  if (f.rowCount) throw new HttpError(409, 'No se puede eliminar: su carpeta del repositorio tiene documentos');
  await query('DELETE FROM areas WHERE id = $1', [a.id]);
  res.status(204).end();
}));

module.exports = router;
