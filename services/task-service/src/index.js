const { createApp, finish, requireEnv } = require('shared/app');
const { waitForDb } = require('shared/db');
const routes = require('./routes');

requireEnv('POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'JWT_SECRET');

const app = createApp('task-service');
app.use('/api/tasks', routes);
finish(app);

const PORT = process.env.PORT || 4003;
waitForDb()
  .then(() => app.listen(PORT, () => console.log(`[task-service] escuchando en :${PORT}`)))
  .catch((e) => { console.error(e.message); process.exit(1); });
