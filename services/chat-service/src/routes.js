const router = require('express').Router();
const { query } = require('shared/db');
const { HttpError, asyncHandler } = require('shared/errors');
const { authenticate, requirePerson } = require('shared/auth');

router.use(authenticate(), requirePerson);

const withPeer = (key) => {
  if (!/^\d+$/.test(key)) throw new HttpError(400, 'Conversación inválida');
  return key;
};

// Conversaciones recientes con el último mensaje y mensajes sin leer
router.get('/conversations', asyncHandler(async (req, res) => {
  const me = req.user.key;
  const { rows } = await query(
    `WITH m AS (
       SELECT CASE WHEN sender_key = $1 THEN recipient_key ELSE sender_key END AS peer, id, sender_key, content, created_at
       FROM chat_messages WHERE recipient_key IS NOT NULL AND (sender_key = $1 OR recipient_key = $1)
     ), last AS (SELECT DISTINCT ON (peer) peer, id, sender_key, content, created_at FROM m ORDER BY peer, id DESC)
     SELECT l.peer AS key, u.name, u.photo_file_id, u.position_id, p.name AS position_name,
            l.content AS last_content, l.sender_key AS last_sender, l.created_at AS last_at, l.id AS last_id,
            (SELECT COUNT(*)::int FROM m WHERE m.peer = l.peer AND m.sender_key = l.peer
               AND m.id > COALESCE((SELECT last_id FROM chat_reads r WHERE r.user_key = $1 AND r.peer_key = l.peer), 0)) AS unread
     FROM last l JOIN users u ON u.id = l.peer::int LEFT JOIN positions p ON p.id = u.position_id
     ORDER BY l.id DESC LIMIT 50`, [me]);
  res.json(rows);
}));

// GET /api/chat/messages?with=<userId>&limit=100
router.get('/messages', asyncHandler(async (req, res) => {
  const peer = withPeer(String(req.query.with || ''));
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
  const { rows } = await query(
    `SELECT * FROM (SELECT id, sender_key, sender_name, recipient_key, content, created_at
       FROM chat_messages
       WHERE (sender_key = $1 AND recipient_key = $2) OR (sender_key = $2 AND recipient_key = $1)
       ORDER BY id DESC LIMIT $3) t ORDER BY id`, [req.user.key, peer, limit]);
  res.json(rows);
}));

// POST /api/chat/read { with }  -> marca la conversación como leída
router.post('/read', asyncHandler(async (req, res) => {
  const peer = withPeer(String(req.body?.with || ''));
  await query(
    `INSERT INTO chat_reads (user_key, peer_key, last_id)
     VALUES ($1, $2, COALESCE((SELECT MAX(id) FROM chat_messages WHERE sender_key = $2 AND recipient_key = $1), 0))
     ON CONFLICT (user_key, peer_key) DO UPDATE SET last_id = EXCLUDED.last_id`, [req.user.key, peer]);
  res.status(204).end();
}));

module.exports = router;
