const router = require('express').Router();
const { query } = require('shared/db');
const { HttpError, asyncHandler } = require('shared/errors');
const { authenticate, requirePerm } = require('shared/auth');

router.use(authenticate());

const SELECT = `SELECT p.id, p.name, p.area_id, p.description, p.reports_to_id, p.created_at,
    a.name AS area_name, r.name AS reports_to_name,
    (SELECT COUNT(*)::int FROM users u WHERE u.position_id = p.id AND u.active) AS people,
    (SELECT COALESCE(array_agg(u.name ORDER BY u.name), '{}') FROM users u WHERE u.position_id = p.id AND u.active) AS holders
  FROM positions p JOIN areas a ON a.id = p.area_id LEFT JOIN positions r ON r.id = p.reports_to_id`;

const find = async (id) => (await query(`${SELECT} WHERE p.id = $1`, [id])).rows[0];

router.get('/', asyncHandler(async (req, res) => {
  const conds = []; const params = [];
  if (/^\d+$/.test(req.query.areaId || '')) { params.push(Number(req.query.areaId)); conds.push(`p.area_id = $${params.length}`); }
  if (req.query.q) { params.push(`%${String(req.query.q).trim()}%`); conds.push(`p.name ILIKE $${params.length}`); }
  const { rows } = await query(`${SELECT} ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY a.name, p.name`, params);
  res.json(rows);
}));

async function parse(b, id) {
  const name = String(b.name ?? '').trim();
  if (!name || name.length > 120) throw new HttpError(400, 'El nombre del cargo es obligatorio (máx. 120 caracteres)');
  const description = String(b.description ?? '').trim();
  if (!description) throw new HttpError(400, 'La descripción de responsabilidades es obligatoria');
  const areaId = Number(b.area_id);
  const a = await query('SELECT 1 FROM areas WHERE id = $1', [areaId]);
  if (!Number.isInteger(areaId) || !a.rowCount) throw new HttpError(400, 'El área seleccionada no existe');

  let reportsTo = null;
  if (b.reports_to_id !== undefined && b.reports_to_id !== null && b.reports_to_id !== '') {
    reportsTo = Number(b.reports_to_id);
    if (!(await find(reportsTo))) throw new HttpError(400, 'El cargo al que reporta no existe');
    if (id) {
      const { rows } = await query(
        `WITH RECURSIVE d AS (SELECT id FROM positions WHERE id = $1 UNION SELECT p.id FROM positions p JOIN d ON p.reports_to_id = d.id)
         SELECT 1 FROM d WHERE id = $2`, [id, reportsTo]);
      if (rows.length) throw new HttpError(400, 'Un cargo no puede reportar a sí mismo ni a uno de sus subordinados');
    }
  }
  return { name, description, areaId, reportsTo };
}

const dup = (e) => { if (e.code === '23505') throw new HttpError(409, 'Ya existe un cargo con ese nombre en el área'); throw e; };

router.post('/', requirePerm('admin'), asyncHandler(async (req, res) => {
  const d = await parse(req.body || {}, null);
  try {
    const { rows } = await query('INSERT INTO positions (name, area_id, description, reports_to_id) VALUES ($1,$2,$3,$4) RETURNING id',
      [d.name, d.areaId, d.description, d.reportsTo]);
    res.status(201).json(await find(rows[0].id));
  } catch (e) { dup(e); }
}));

router.put('/:id(\\d+)', requirePerm('admin'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const cur = await find(id);
  if (!cur) throw new HttpError(404, 'Cargo no encontrado');
  const d = await parse(req.body || {}, id);
  if (d.areaId !== cur.area_id && cur.people) throw new HttpError(409, 'No puedes cambiar de área un cargo que tiene personas asignadas');
  try {
    await query('UPDATE positions SET name=$1, area_id=$2, description=$3, reports_to_id=$4 WHERE id=$5',
      [d.name, d.areaId, d.description, d.reportsTo, id]);
  } catch (e) { dup(e); }
  res.json(await find(id));
}));

router.delete('/:id(\\d+)', requirePerm('admin'), asyncHandler(async (req, res) => {
  const cur = await find(req.params.id);
  if (!cur) throw new HttpError(404, 'Cargo no encontrado');
  if (cur.people) throw new HttpError(409, 'No se puede eliminar: el cargo tiene personas asignadas');
  const f = await query("SELECT 1 FROM files WHERE context = 'repo' AND folder_kind = 'position' AND folder_id = $1 LIMIT 1", [cur.id]);
  if (f.rowCount) throw new HttpError(409, 'No se puede eliminar: su carpeta del repositorio tiene documentos');
  await query('DELETE FROM positions WHERE id = $1', [cur.id]);
  res.status(204).end();
}));

module.exports = router;
