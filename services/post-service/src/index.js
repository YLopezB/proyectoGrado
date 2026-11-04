const { createApp, finish, requireEnv } = require('shared/app');
const { waitForDb } = require('shared/db');
const routes = require('./routes');

requireEnv('POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'JWT_SECRET');

const app = createApp('post-service');
app.use('/api/posts', routes);
finish(app);

const PORT = process.env.PORT || 4007;
waitForDb()
  .then(() => app.listen(PORT, () => console.log(`[post-service] escuchando en :${PORT}`)))
  .catch((e) => { console.error(e.message); process.exit(1); });
