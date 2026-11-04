const { createApp, finish, requireEnv } = require('shared/app');
const { waitForDb, query } = require('shared/db');
const routes = require('./routes');

requireEnv('POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'JWT_SECRET', 'ADMIN_USER', 'ADMIN_PASSWORD');

const app = createApp('auth-service');
app.use('/api/auth', routes);
finish(app);

const PORT = process.env.PORT || 4001;
// Bases de datos creadas antes de existir esta tabla (el esquema inicial solo corre una vez)
const ensureSchema = () => query(`CREATE TABLE IF NOT EXISTS admin_account (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT        NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)`);

waitForDb()
  .then(ensureSchema)
  .then(() => app.listen(PORT, () => console.log(`[auth-service] escuchando en :${PORT}`)))
  .catch((e) => { console.error(e.message); process.exit(1); });
