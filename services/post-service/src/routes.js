const router = require('express').Router();
const { query } = require('shared/db');
const { HttpError, asyncHandler } = require('shared/errors');
const { authenticate, requirePerm, can } = require('shared/auth');

router.use(authenticate());

async function authorArea(user) {
  if (!user.areaId) return '';
  const r = await query('SELECT name FROM areas WHERE id = $1', [user.areaId]);
  return r.rows[0]?.name || '';
}

// Publicaciones visibles: las de toda la empresa y las dirigidas al área de la persona (el administrador ve todo)
const visibleSql = (user, params) => {
  if (user.role === 'admin' || can(user, 'posts')) return 'TRUE';
  params.push(user.areaId || 0);
  return `(p.audience_area_id IS NULL OR p.audience_area_id = $${params.length})`;
};

async function loadPosts(user, { id, limit = 20, before } = {}) {
  const params = [user.key];
  const conds = [];
  if (id) { params.push(id); conds.push(`p.id = $${params.length}`); }
  if (before) { params.push(Number(before)); conds.push(`p.id < $${params.length}`); }
  conds.push(visibleSql(user, params));
  params.push(limit);
  const { rows: posts } = await query(
    `SELECT p.id, p.title, p.body, p.cover_file_id, p.cover_alt, p.audience_area_id, p.author_id, p.author_name, p.author_area,
            p.created_at, a.name AS audience_area_name,
            (SELECT COUNT(*)::int FROM post_likes l WHERE l.post_id = p.id) AS likes,
            EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_key = $1) AS liked
     FROM posts p LEFT JOIN areas a ON a.id = p.audience_area_id
     WHERE ${conds.join(' AND ')} ORDER BY p.created_at DESC, p.id DESC LIMIT $${params.length}`, params);
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  const { rows: comments } = await query(
    `SELECT c.id, c.post_id, c.author_key, c.author_name, c.author_area, c.body, c.created_at,
            (SELECT COUNT(*)::int FROM comment_likes l WHERE l.comment_id = c.id) AS likes,
            EXISTS (SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.user_key = $2) AS liked
     FROM post_comments c WHERE c.post_id = ANY($1::int[]) ORDER BY c.id`, [ids, user.key]);
  const byPost = new Map(ids.map((i) => [i, []]));
  comments.forEach((c) => byPost.get(c.post_id).push(c));
  return posts.map((p) => ({ ...p, comments: byPost.get(p.id) }));
}

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  res.json(await loadPosts(req.user, { limit, before: req.query.before }));
}));

async function parse(b) {
  const title = String(b.title ?? '').trim();
  if (!title || title.length > 200) throw new HttpError(400, 'El título es obligatorio (máx. 200 caracteres)');
  const body = String(b.body ?? '').trim();
  if (!body) throw new HttpError(400, 'La descripción de la publicación es obligatoria');
  if (body.length > 10000) throw new HttpError(400, 'La descripción es demasiado larga');
  const coverAlt = String(b.cover_alt ?? '').trim().slice(0, 240);
  const cover = String(b.cover_file_id ?? '');
  const f = await query("SELECT 1 FROM files WHERE id::text = $1 AND context = 'post' AND category = 'image'", [cover]);
  if (!f.rowCount) throw new HttpError(400, 'La imagen de portada es obligatoria');
  let audience = null;
  if (b.audience_area_id !== undefined && b.audience_area_id !== null && b.audience_area_id !== '' && b.audience_area_id !== 'all') {
    audience = Number(b.audience_area_id);
    const a = await query('SELECT 1 FROM areas WHERE id = $1', [audience]);
    if (!a.rowCount) throw new HttpError(400, 'El área de la audiencia no existe');
  }
  return { title, body, cover, coverAlt, audience };
}

router.post('/', requirePerm('posts'), asyncHandler(async (req, res) => {
  const d = await parse(req.body || {});
  const { rows } = await query(
    `INSERT INTO posts (title, body, cover_file_id, cover_alt, audience_area_id, author_id, author_name, author_area)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [d.title, d.body, d.cover, d.coverAlt, d.audience, req.user.id, req.user.name, await authorArea(req.user)]);
  res.status(201).json((await loadPosts(req.user, { id: rows[0].id }))[0]);
}));

router.put('/:id(\\d+)', requirePerm('posts'), asyncHandler(async (req, res) => {
  const cur = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  if (!cur.rows[0]) throw new HttpError(404, 'Publicación no encontrada');
  const d = await parse(req.body || {});
  await query('UPDATE posts SET title=$1, body=$2, cover_file_id=$3, cover_alt=$4, audience_area_id=$5, updated_at=now() WHERE id=$6',
    [d.title, d.body, d.cover, d.coverAlt, d.audience, req.params.id]);
  res.json((await loadPosts(req.user, { id: Number(req.params.id) }))[0]);
}));

router.delete('/:id(\\d+)', requirePerm('posts'), asyncHandler(async (req, res) => {
  const r = await query('DELETE FROM posts WHERE id = $1', [req.params.id]);
  if (!r.rowCount) throw new HttpError(404, 'Publicación no encontrada');
  res.status(204).end();
}));

const requireVisible = async (req, id) => {
  const p = (await loadPosts(req.user, { id: Number(id) }))[0];
  if (!p) throw new HttpError(404, 'Publicación no encontrada');
  return p;
};

router.post('/:id(\\d+)/like', asyncHandler(async (req, res) => {
  const p = await requireVisible(req, req.params.id);
  if (p.liked) await query('DELETE FROM post_likes WHERE post_id = $1 AND user_key = $2', [p.id, req.user.key]);
  else await query('INSERT INTO post_likes (post_id, user_key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [p.id, req.user.key]);
  const n = await query('SELECT COUNT(*)::int AS n FROM post_likes WHERE post_id = $1', [p.id]);
  res.json({ liked: !p.liked, likes: n.rows[0].n });
}));

router.post('/:id(\\d+)/comments', asyncHandler(async (req, res) => {
  const p = await requireVisible(req, req.params.id);
  const body = String(req.body?.body ?? '').trim();
  if (!body || body.length > 1000) throw new HttpError(400, 'El comentario no puede estar vacío (máx. 1000 caracteres)');
  const { rows } = await query(
    `INSERT INTO post_comments (post_id, author_key, author_name, author_area, body) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, post_id, author_key, author_name, author_area, body, created_at, 0 AS likes, FALSE AS liked`,
    [p.id, req.user.key, req.user.name, await authorArea(req.user), body]);
  res.status(201).json(rows[0]);
}));

// Borrar un comentario: su autor o quien modera (permiso "posts")
router.delete('/comments/:cid(\\d+)', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT author_key FROM post_comments WHERE id = $1', [req.params.cid]);
  if (!rows[0]) throw new HttpError(404, 'Comentario no encontrado');
  if (rows[0].author_key !== req.user.key && !can(req.user, 'posts')) throw new HttpError(403, 'No puedes borrar este comentario');
  await query('DELETE FROM post_comments WHERE id = $1', [req.params.cid]);
  res.status(204).end();
}));

router.post('/comments/:cid(\\d+)/like', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, post_id FROM post_comments WHERE id = $1', [req.params.cid]);
  if (!rows[0]) throw new HttpError(404, 'Comentario no encontrado');
  await requireVisible(req, rows[0].post_id);
  const had = await query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_key = $2', [rows[0].id, req.user.key]);
  if (!had.rowCount) await query('INSERT INTO comment_likes (comment_id, user_key) VALUES ($1,$2)', [rows[0].id, req.user.key]);
  const n = await query('SELECT COUNT(*)::int AS n FROM comment_likes WHERE comment_id = $1', [rows[0].id]);
  res.json({ liked: !had.rowCount, likes: n.rows[0].n });
}));

module.exports = router;
