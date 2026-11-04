const router = require('express').Router();
const { query } = require('shared/db');
const { HttpError, asyncHandler } = require('shared/errors');
const { authenticate, requirePerm, requirePerson } = require('shared/auth');

router.use(authenticate(), requirePerson, requirePerm('tasks'));

const KINDS = ['asignada', 'autoasignada', 'solicitud', 'delegada'];
const SELECT = `SELECT t.id, t.title, t.description, t.kind, t.status, to_char(t.due_date,'YYYY-MM-DD') AS due_date,
    t.created_at, t.completed_at, t.completion_note, t.creator_id, t.creator_name, t.assignee_id,
    asg.name AS assignee_name, asg.photo_file_id AS assignee_photo,
    t.file_id, f.original_name AS file_name, f.size AS file_size,
    t.completion_file_id, cf.original_name AS completion_file_name, cf.size AS completion_file_size
  FROM tasks t
  JOIN users asg ON asg.id = t.assignee_id
  LEFT JOIN files f ON f.id = t.file_id
  LEFT JOIN files cf ON cf.id = t.completion_file_id`;

const shape = (r) => ({ ...r, file_size: r.file_size == null ? null : Number(r.file_size), completion_file_size: r.completion_file_size == null ? null : Number(r.completion_file_size) });
const find = async (id) => { const r = (await query(`${SELECT} WHERE t.id = $1`, [id])).rows[0]; return r && shape(r); };

// scope=mine (por defecto): tareas que recibí · scope=assigned: tareas que yo creé para OTRAS personas
const SCOPE = {
  mine: 't.assignee_id = $1',
  assigned: 't.creator_id = $1 AND t.assignee_id <> $1',
};
const scopeOf = (req) => (req.query.scope === 'assigned' ? 'assigned' : 'mine');

// GET /api/tasks/stats?scope=mine|assigned   (assigned incluye las personas a las que he asignado tareas)
router.get('/stats', asyncHandler(async (req, res) => {
  const scope = scopeOf(req);
  const { rows } = await query(
    `SELECT COUNT(*) FILTER (WHERE t.status = 'pending')::int AS pending,
            COUNT(*) FILTER (WHERE t.status = 'done')::int AS done,
            COUNT(*) FILTER (WHERE t.status = 'pending' AND t.due_date < CURRENT_DATE)::int AS overdue
     FROM tasks t WHERE ${SCOPE[scope]}`, [req.user.id]);
  if (scope === 'assigned') {
    const people = await query(
      `SELECT DISTINCT u.id, u.name FROM tasks t JOIN users u ON u.id = t.assignee_id
       WHERE ${SCOPE.assigned} ORDER BY u.name`, [req.user.id]);
    rows[0].people = people.rows;
  }
  res.json(rows[0]);
}));

// Campana de notificaciones (últimos 14 días):
//  type 'new'  -> tareas que otras personas me asignaron y siguen pendientes
//  type 'done' -> tareas que yo asigné y la otra persona ya realizó
router.get('/notifications', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM (
       (${SELECT} WHERE t.assignee_id = $1 AND t.status = 'pending' AND t.creator_id IS DISTINCT FROM $1
          AND t.created_at > now() - interval '14 days')
       UNION ALL
       (${SELECT} WHERE ${SCOPE.assigned} AND t.status = 'done'
          AND t.completed_at > now() - interval '14 days')
     ) n ORDER BY COALESCE(n.completed_at, n.created_at) DESC LIMIT 15`, [req.user.id]);
  res.json(rows.map((r) => ({ ...shape(r), type: r.status === 'done' ? 'done' : 'new' })));
}));

// GET /api/tasks?scope=mine|assigned&status=pending|done&q=&kind=&assignee=&date=AAAA-MM-DD&month=AAAA-MM
router.get('/', asyncHandler(async (req, res) => {
  const scope = scopeOf(req);
  const status = req.query.status === 'done' ? 'done' : 'pending';
  const params = [req.user.id, status];
  const conds = [`(${SCOPE[scope]})`, 't.status = $2'];
  if (scope === 'assigned' && /^\d+$/.test(req.query.assignee || '')) {
    params.push(Number(req.query.assignee)); conds.push(`t.assignee_id = $${params.length}`);
  }
  if (req.query.q) {
    params.push(`%${String(req.query.q).trim()}%`);
    const n = `$${params.length}`;
    conds.push(`(t.title ILIKE ${n} OR t.description ILIKE ${n}${scope === 'assigned' ? ` OR asg.name ILIKE ${n}` : ''})`);
  }
  if (KINDS.includes(req.query.kind)) { params.push(req.query.kind); conds.push(`t.kind = $${params.length}`); }
  const dateCol = status === 'done' ? 't.completed_at::date' : 't.due_date';
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '')) { params.push(req.query.date); conds.push(`${dateCol} = $${params.length}`); }
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month || '')) {
    params.push(`${req.query.month}-01`);
    conds.push(`date_trunc('month', ${dateCol}) = date_trunc('month', $${params.length}::date)`);
  }
  const order = status === 'done' ? 't.completed_at DESC' : 't.due_date NULLS LAST, t.created_at DESC';
  const { rows } = await query(`${SELECT} WHERE ${conds.join(' AND ')} ORDER BY ${order} LIMIT 500`, params);
  res.json(rows.map(shape));
}));

async function validFile(fileId, userId) {
  if (fileId === undefined || fileId === null || fileId === '') return null;
  const { rows } = await query("SELECT id FROM files WHERE id::text = $1 AND context = 'task' AND owner_id = $2", [String(fileId), userId]);
  if (!rows[0]) throw new HttpError(400, 'El archivo adjunto no es válido');
  return rows[0].id;
}

// ¿Quien crea la tarea tiene autoridad sobre quien la recibe?  -> "asignada"; si no -> "solicitud"
async function kindFor(creator, assignee) {
  if (creator.id === assignee.id) return 'autoasignada';
  const { rows } = await query('SELECT level, area_id, position_id FROM users WHERE id = $1', [creator.id]);
  const me = rows[0];
  const supervisor = ['lider', 'responsable', 'administrador'].includes(me.level);
  if (supervisor && me.area_id) {
    const r = await query(
      `WITH RECURSIVE d AS (SELECT id FROM areas WHERE id = $1 UNION SELECT a.id FROM areas a JOIN d ON a.parent_id = d.id)
       SELECT 1 FROM d WHERE id = $2`, [me.area_id, assignee.area_id]);
    if (r.rowCount) return 'asignada';
  }
  if (me.position_id) { // cargo al que reporta directamente la persona
    const r = await query(
      `WITH RECURSIVE up AS (SELECT id, reports_to_id FROM positions WHERE id = $1
         UNION SELECT p.id, p.reports_to_id FROM positions p JOIN up ON p.id = up.reports_to_id)
       SELECT 1 FROM up WHERE id = $2`, [assignee.position_id, me.position_id]);
    if (r.rowCount) return 'asignada';
  }
  return 'solicitud';
}

// POST /api/tasks { assignee_id, title, description, due_date, file_id }
router.post('/', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const title = String(b.title ?? '').trim();
  if (!title || title.length > 200) throw new HttpError(400, 'El título es obligatorio (máx. 200 caracteres)');
  const description = String(b.description ?? '').trim();
  if (!description) throw new HttpError(400, 'La descripción es obligatoria');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.due_date || '') || Number.isNaN(Date.parse(b.due_date))) throw new HttpError(400, 'La fecha de entrega es obligatoria');
  const assigneeId = Number(b.assignee_id ?? req.user.id);
  const a = await query('SELECT id, area_id, position_id FROM users WHERE id = $1 AND active', [assigneeId]);
  if (!a.rows[0]) throw new HttpError(400, 'La persona destinataria no existe o está inactiva');
  const fileId = await validFile(b.file_id, req.user.id);
  const kind = await kindFor(req.user, a.rows[0]);
  const { rows } = await query(
    `INSERT INTO tasks (title, description, creator_id, creator_name, assignee_id, kind, due_date, file_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [title, description, req.user.id, req.user.name, assigneeId, kind, b.due_date, fileId]);
  res.status(201).json(await find(rows[0].id));
}));

// POST /api/tasks/:id/complete { note, file_id }   (solo quien la recibió)
router.post('/:id(\\d+)/complete', asyncHandler(async (req, res) => {
  const t = await find(req.params.id);
  if (!t || t.assignee_id !== req.user.id) throw new HttpError(404, 'Tarea no encontrada');
  if (t.status === 'done') throw new HttpError(409, 'La tarea ya fue realizada');
  const note = String(req.body?.note ?? '').trim().slice(0, 2000);
  const fileId = await validFile(req.body?.file_id, req.user.id);
  await query(`UPDATE tasks SET status = 'done', completion_note = $1, completion_file_id = $2, completed_at = now() WHERE id = $3`,
    [note || null, fileId, t.id]);
  res.json(await find(t.id));
}));

// Eliminar: quien la creó (si sigue pendiente)
router.delete('/:id(\\d+)', asyncHandler(async (req, res) => {
  const t = await find(req.params.id);
  if (!t || (t.creator_id !== req.user.id && t.assignee_id !== req.user.id)) throw new HttpError(404, 'Tarea no encontrada');
  if (t.status === 'done') throw new HttpError(409, 'No se puede eliminar una tarea ya realizada');
  if (t.creator_id !== req.user.id) throw new HttpError(403, 'Solo quien creó la tarea puede eliminarla');
  await query('DELETE FROM tasks WHERE id = $1', [t.id]);
  res.status(204).end();
}));

module.exports = router;
