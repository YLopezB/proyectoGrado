const fs = require('fs');
const { createApp, finish, requireEnv } = require('shared/app');
const { waitForDb } = require('shared/db');
const { FILES_DIR, TMP_DIR } = require('./storage');
const routes = require('./routes');
const internal = require('./internal');

requireEnv('POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'JWT_SECRET', 'INTERNAL_API_KEY');

fs.mkdirSync(FILES_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const app = createApp('repository-service');
app.use('/api/files', routes);
app.use('/internal', internal); // no expuesto por el gateway
finish(app);

const PORT = process.env.PORT || 4004;
waitForDb()
  .then(() => app.listen(PORT, () => console.log(`[repository-service] escuchando en :${PORT} (datos en ${FILES_DIR})`)))
  .catch((e) => { console.error(e.message); process.exit(1); });
