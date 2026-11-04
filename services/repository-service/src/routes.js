const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const router = require('express').Router();
const multer = require('multer');
const { query } = require('shared/db');
const { HttpError, asyncHandler } = require('shared/errors');
const { authenticate, can } = require('shared/auth');
const { FILES_DIR, TMP_DIR, MAX_FILE_BYTES, USER_QUOTA_BYTES, BLOCKED_EXT } = require('./storage');

router.use(authenticate());

const PREVIEW_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.pdf': 'application/pdf',
};
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp'];
const FORMATS = {
  pdf: ['.pdf'],
  word: ['.doc', '.docx', '.odt', '.rtf', '.txt'],
  excel: ['.xls', '.xlsx', '.csv', '.ods'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
};
const CONTEXTS = { repo: 'docs', avatar: null, post: 'posts', task: 'tasks' }; // contexto -> permiso necesario

const SELECT = `SELECT f.id, f.owner_id, f.uploader_name, f.original_name, f.mime_type, f.size, f.category, f.context,
                       f.folder_kind, f.folder_id, f.created_at
                FROM files f`;
const shape = (r) => ({ ...r, size: Number(r.size) });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 20 },
});

const fixName = (n) => Buffer.from(n, 'latin1').toString('utf8'); // multer entrega nombres en latin1
const cleanName = (n) => path.basename(fixName(n)).replace(/[\x00-\x1f<>:"/\\|?*]/g, '_').slice(0, 200) || 'archivo';

function categoryOf(mime, ext) {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || mime.startsWith('text/') || /(msword|officedocument|opendocument|rtf|csv)/.test(mime)
    || ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.odt', '.ods', '.rtf'].includes(ext)) return 'document';
  return 'other';
}

const rmQuiet = (p) => fsp.rm(p, { force: true }).catch(() => {});
const diskPath = (f) => path.join(FILES_DIR, f.stored_name);
const contentDisposition = (type, name) => `${type}; filename="${name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(name)}`;

/* ---------------------------- Carpetas (árbol de la empresa) ---------------------------- */
router.get('/folders', asyncHandler(async (req, res) => {
  const [areas, positions, counts, company] = await Promise.all([
    query('SELECT id, name, parent_id FROM areas ORDER BY name'),
    query('SELECT id, name, area_id FROM positions ORDER BY name'),
    query(`SELECT folder_kind, folder_id, COUNT(*)::int AS n FROM files WHERE context = 'repo' GROUP BY 1, 2`),
    query('SELECT name FROM company WHERE id = 1'),
  ]);
  const direct = new Map(counts.rows.map((c) => [`${c.folder_kind || 'root'}:${c.folder_id || 0}`, c.n]));
  const own = (kind, id) => direct.get(`${kind}:${id}`) || 0;

  const posByArea = new Map();
  positions.rows.forEach((p) => { (posByArea.get(p.area_id) || posByArea.set(p.area_id, []).get(p.area_id)).push(p); });
  const kidsByParent = new Map();
  areas.rows.forEach((a) => { (kidsByParent.get(a.parent_id || 0) || kidsByParent.set(a.parent_id || 0, []).get(a.parent_id || 0)).push(a); });

  const seen = new Set();
  const buildArea = (a) => {
    seen.add(a.id);
    const children = [
      ...(kidsByParent.get(a.id) || []).filter((c) => !seen.has(c.id)).map(buildArea),
      ...(posByArea.get(a.id) || []).map((p) => ({ kind: 'position', id: p.id, name: p.name, count: own('position', p.id), children: [] })),
    ];
    return { kind: 'area', id: a.id, name: a.name, count: own('area', a.id) + children.reduce((s, c) => s + c.count, 0), children };
  };
  const top = (kidsByParent.get(0) || []).map(buildArea);
  const total = (await query("SELECT COUNT(*)::int AS n FROM files WHERE context = 'repo'")).rows[0].n;
  res.json({
    kind: 'company', id: null, count: total,
    name: company.rows[0]?.name || process.env.COMPANY_NAME || 'Nombre empresa',
    children: top,
  });
}));

/* ---------------------------------- Listado ---------------------------------- */
// GET /api/files?folderKind=area|position&folderId=&q=&format=pdf|word|excel|image|other
router.get('/', asyncHandler(async (req, res) => {
  const conds = ["f.context = 'repo'"]; const params = [];
  const { folderKind, folderId } = req.query;
  if (folderKind === 'area' && /^\d+$/.test(folderId || '')) {
    params.push(Number(folderId));
    conds.push(`((f.folder_kind = 'area' AND f.folder_id IN (WITH RECURSIVE d AS (SELECT id FROM areas WHERE id = $${params.length}
        UNION SELECT a.id FROM areas a JOIN d ON a.parent_id = d.id) SELECT id FROM d))
      OR (f.folder_kind = 'position' AND f.folder_id IN (WITH RECURSIVE d AS (SELECT id FROM areas WHERE id = $${params.length}
        UNION SELECT a.id FROM areas a JOIN d ON a.parent_id = d.id) SELECT p.id FROM positions p JOIN d ON p.area_id = d.id)))`);
  } else if (folderKind === 'position' && /^\d+$/.test(folderId || '')) {
    params.push(Number(folderId));
    conds.push(`(f.folder_kind = 'position' AND f.folder_id = $${params.length})`);
  }
  if (req.query.q) { params.push(`%${String(req.query.q).trim()}%`); conds.push(`f.original_name ILIKE $${params.length}`); }
  const fmt = req.query.format;
  if (FORMATS[fmt]) {
    params.push(FORMATS[fmt].map((e) => `%${e}`));
    conds.push(`lower(f.original_name) LIKE ANY($${params.length}::text[])`);
  } else if (fmt === 'other') {
    params.push(Object.values(FORMATS).flat().map((e) => `%${e}`));
    conds.push(`NOT (lower(f.original_name) LIKE ANY($${params.length}::text[]))`);
  }
  const { rows } = await query(`${SELECT} WHERE ${conds.join(' AND ')} ORDER BY f.created_at DESC LIMIT 1000`, params);
  res.json(rows.map(shape));
}));

/* ---------------------------------- Subida ---------------------------------- */
// POST /api/files  multipart: files[] + context (repo|avatar|post|task) + folderKind/folderId (repo) + userId (avatar, admin)
router.post('/', (req, res, next) => {
  upload.array('files', 20)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, `Un archivo supera el máximo de ${MAX_FILE_BYTES / 1024 / 1024} MB`));
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return next(new HttpError(400, 'Máximo 20 archivos por carga'));
    next(err);
  });
}, asyncHandler(async (req, res) => {
  const files = req.files || [];
  const cleanup = () => Promise.all(files.map((f) => rmQuiet(f.path)));
  const movedPaths = [];
  try {
    if (!files.length) throw new HttpError(400, 'No se recibió ningún archivo');
    const b = req.body || {};
    const context = b.context || 'repo';
    if (!(context in CONTEXTS)) throw new HttpError(400, 'Contexto inválido');
    if (CONTEXTS[context] && !can(req.user, CONTEXTS[context])) throw new HttpError(403, 'No tienes permiso para subir este tipo de archivos');
    if (context !== 'repo' && files.length > 1) throw new HttpError(400, 'Solo se permite un archivo');

    // Carpeta del repositorio
    let folderKind = null; let folderId = null;
    if (context === 'repo' && b.folderKind) {
      folderKind = b.folderKind; folderId = Number(b.folderId);
      if (!['area', 'position'].includes(folderKind) || !Number.isInteger(folderId)) throw new HttpError(400, 'Carpeta inválida');
      const t = await query(`SELECT 1 FROM ${folderKind === 'area' ? 'areas' : 'positions'} WHERE id = $1`, [folderId]);
      if (!t.rowCount) throw new HttpError(400, 'La carpeta seleccionada no existe');
    }

    // Propietario
    let ownerId = req.user.id; // null para el administrador del .env
    let avatarUser = null;
    if (context === 'avatar') {
      avatarUser = req.user.id;
      if (b.userId !== undefined && b.userId !== '' && Number(b.userId) !== req.user.id) {
        if (!can(req.user, 'admin')) throw new HttpError(403, 'No puedes cambiar la foto de otra persona');
        avatarUser = Number(b.userId);
      }
      if (!Number.isInteger(avatarUser)) throw new HttpError(400, 'Indica a qué persona pertenece la foto');
      const u = await query('SELECT 1 FROM users WHERE id = $1', [avatarUser]);
      if (!u.rowCount) throw new HttpError(400, 'La persona no existe');
      ownerId = avatarUser;
    }

    const prepared = files.map((f) => {
      const name = cleanName(f.originalname);
      const ext = path.extname(name).toLowerCase();
      if (BLOCKED_EXT.includes(ext.slice(1))) throw new HttpError(400, `Tipo de archivo no permitido: ${ext}`);
      const mime = f.mimetype || 'application/octet-stream';
      if (context === 'avatar' || context === 'post') {
        if (!IMAGE_EXT.includes(ext)) throw new HttpError(400, 'La imagen debe ser JPG, PNG o WEBP');
        const limit = (context === 'avatar' ? 5 : 10) * 1024 * 1024;
        if (f.size > limit) throw new HttpError(413, `La imagen puede pesar máximo ${limit / 1024 / 1024} MB`);
      }
      return { tmp: f.path, name, ext, mime, size: f.size };
    });

    if (ownerId) {
      const used = Number((await query('SELECT COALESCE(SUM(size),0) AS s FROM files WHERE owner_id = $1', [ownerId])).rows[0].s);
      const incoming = prepared.reduce((a, f) => a + f.size, 0);
      if (used + incoming > USER_QUOTA_BYTES) throw new HttpError(413, `Se superaría la cuota de almacenamiento (${USER_QUOTA_BYTES / 1024 / 1024} MB)`);
    }

    const saved = [];
    for (const f of prepared) {
      const id = crypto.randomUUID();
      const stored = `${id.slice(0, 2)}/${id}${f.ext}`;
      await fsp.mkdir(path.join(FILES_DIR, id.slice(0, 2)), { recursive: true });
      await fsp.rename(f.tmp, path.join(FILES_DIR, stored)); // mismo volumen: operación atómica
      movedPaths.push(path.join(FILES_DIR, stored));
      await query(
        `INSERT INTO files (id, owner_id, uploader_name, original_name, stored_name, mime_type, size, category, context, folder_kind, folder_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, ownerId, req.user.name, f.name, stored, f.mime, f.size, categoryOf(f.mime, f.ext), context, folderKind, folderId],
      );
      saved.push(id);
    }

    if (context === 'avatar') { // reemplaza la foto anterior
      const old = await query('SELECT f.id, f.stored_name FROM users u JOIN files f ON f.id = u.photo_file_id WHERE u.id = $1', [avatarUser]);
      await query('UPDATE users SET photo_file_id = $1, updated_at = now() WHERE id = $2', [saved[0], avatarUser]);
      if (old.rows[0]) {
        await query('DELETE FROM files WHERE id = $1', [old.rows[0].id]);
        await rmQuiet(path.join(FILES_DIR, old.rows[0].stored_name));
      }
    }
    const { rows } = await query(`${SELECT} WHERE f.id = ANY($1::uuid[]) ORDER BY f.created_at`, [saved]);
    res.status(201).json(rows.map(shape));
  } catch (e) {
    await cleanup();
    await Promise.all(movedPaths.map(rmQuiet));
    throw e;
  }
}));

/* -------------------------- Descarga / vista previa / borrado -------------------------- */
async function loadAllowed(req, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'Archivo no encontrado');
  const { rows } = await query('SELECT * FROM files WHERE id = $1', [id]);
  const f = rows[0];
  if (!f) throw new HttpError(404, 'Archivo no encontrado');
  if (f.context === 'task' && !can(req.user, 'admin') && f.owner_id !== req.user.id) {
    // adjuntos de tareas: solo quien creó o recibió la tarea
    const t = await query(
      `SELECT 1 FROM tasks WHERE (file_id = $1 OR completion_file_id = $1) AND (creator_id = $2 OR assignee_id = $2) LIMIT 1`, [f.id, req.user.id || 0]);
    if (!t.rowCount) throw new HttpError(404, 'Archivo no encontrado');
  }
  return f;
}

router.get('/:id/download', asyncHandler(async (req, res) => {
  const f = await loadAllowed(req, req.params.id);
  const p = diskPath(f);
  if (!fs.existsSync(p)) throw new HttpError(404, 'El archivo ya no existe en el almacenamiento');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', contentDisposition('attachment', f.original_name));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', f.size);
  fs.createReadStream(p).on('error', () => res.destroy()).pipe(res);
}));

// Vista previa solo para imágenes y PDF
router.get('/:id/preview', asyncHandler(async (req, res) => {
  const f = await loadAllowed(req, req.params.id);
  const type = PREVIEW_TYPES[path.extname(f.original_name).toLowerCase()];
  if (!type) throw new HttpError(415, 'Este tipo de archivo no tiene vista previa');
  const p = diskPath(f);
  if (!fs.existsSync(p)) throw new HttpError(404, 'El archivo ya no existe en el almacenamiento');
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', contentDisposition('inline', f.original_name));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Length', f.size);
  fs.createReadStream(p).on('error', () => res.destroy()).pipe(res);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const f = await loadAllowed(req, req.params.id);
  if (f.owner_id !== req.user.id && !can(req.user, 'admin')) throw new HttpError(403, 'Solo quien subió el archivo o un administrador puede eliminarlo');
  if (f.context === 'avatar') await query('UPDATE users SET photo_file_id = NULL WHERE photo_file_id = $1', [f.id]);
  await query('DELETE FROM files WHERE id = $1', [f.id]);
  await rmQuiet(diskPath(f));
  res.status(204).end();
}));

module.exports = router;
