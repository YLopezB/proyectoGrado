const { createApp, finish, requireEnv } = require('shared/app');
const { waitForDb } = require('shared/db');
const routes = require('./routes');

requireEnv('POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'JWT_SECRET', 'ADMIN_USER', 'INTERNAL_API_KEY');

const app = createApp('user-service');
app.use('/api/users', routes);
finish(app);

const PORT = process.env.PORT || 4002;
waitForDb()
  .then(() => app.listen(PORT, () => console.log(`[user-service] escuchando en :${PORT}`)))
  .catch((e) => { console.error(e.message); process.exit(1); });
