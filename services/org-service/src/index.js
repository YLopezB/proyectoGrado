const fs = require('fs');
const path = require('path');
const { createApp, finish, requireEnv } = require('shared/app');
const { waitForDb } = require('shared/db');
const company = require('./company');
const areas = require('./areas');
const positions = require('./positions');

requireEnv('POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'JWT_SECRET');

const DATA_DIR = process.env.DATA_DIR || '/data';
fs.mkdirSync(path.join(DATA_DIR, 'company'), { recursive: true });

const app = createApp('org-service');
app.use('/api/company', company);
app.use('/api/areas', areas);
app.use('/api/positions', positions);
finish(app);

const PORT = process.env.PORT || 4006;
waitForDb()
  .then(() => app.listen(PORT, () => console.log(`[org-service] escuchando en :${PORT}`)))
  .catch((e) => { console.error(e.message); process.exit(1); });
