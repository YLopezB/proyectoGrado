const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createApp, finish, requireEnv } = require('shared/app');
const { waitForDb, query } = require('shared/db');
const routes = require('./routes');

requireEnv('POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'JWT_SECRET');

const app = createApp('chat-service');
app.use('/api/chat', routes);
finish(app);

const server = http.createServer(app);
const io = new Server(server, { path: '/socket.io', maxHttpBufferSize: 1e5 });

const online = new Map(); // key -> nº de conexiones
const broadcastPresence = () => io.emit('presence', [...online.keys()]);

// Autenticación del socket con el mismo JWT del resto del sistema
io.use(async (socket, next) => {
  try {
    const p = jwt.verify(socket.handshake.auth?.token || '', process.env.JWT_SECRET);
    if (p.mcp) return next(new Error('PASSWORD_CHANGE_REQUIRED'));
    if (p.role !== 'admin') {
      const { rows } = await query('SELECT active FROM users WHERE id = $1', [Number(p.sub)]);
      if (!rows[0]?.active) return next(new Error('UNAUTHORIZED'));
    }
    socket.data.user = { key: p.sub, role: p.role, name: p.name };
    next();
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
});

io.on('connection', (socket) => {
  const me = socket.data.user;
  socket.join(`u:${me.key}`);
  online.set(me.key, (online.get(me.key) || 0) + 1);
  broadcastPresence();

  // client -> server: { to: null | 'admin' | '<userId>', content }
  socket.on('message:send', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const content = String(payload?.content ?? '').trim();
      const to = payload?.to ? String(payload.to) : null;
      if (!content || content.length > 2000) return reply({ ok: false, error: 'Mensaje vacío o demasiado largo (máx. 2000)' });
      if (me.role === 'admin') return reply({ ok: false, error: 'El administrador no participa en el chat' });
      if (!to || !/^\d+$/.test(to)) return reply({ ok: false, error: 'Destinatario no válido' });
      if (to === me.key) return reply({ ok: false, error: 'No puedes escribirte a ti mismo' });
      const r = await query('SELECT 1 FROM users WHERE id = $1 AND active', [Number(to)]);
      if (!r.rowCount) return reply({ ok: false, error: 'Destinatario no válido' });
      const { rows } = await query(
        `INSERT INTO chat_messages (sender_key, sender_name, recipient_key, content)
         VALUES ($1,$2,$3,$4) RETURNING id, sender_key, sender_name, recipient_key, content, created_at`,
        [me.key, me.name, to, content],
      );
      const msg = rows[0];
      io.to(`u:${to}`).to(`u:${me.key}`).emit('message:new', msg);
      reply({ ok: true });
    } catch (e) {
      console.error('[chat] error al enviar:', e.message);
      reply({ ok: false, error: 'No se pudo enviar el mensaje' });
    }
  });

  socket.on('disconnect', () => {
    const n = (online.get(me.key) || 1) - 1;
    if (n <= 0) online.delete(me.key); else online.set(me.key, n);
    broadcastPresence();
  });
});

const PORT = process.env.PORT || 4005;
waitForDb()
  .then(() => server.listen(PORT, () => console.log(`[chat-service] escuchando en :${PORT}`)))
  .catch((e) => { console.error(e.message); process.exit(1); });
