const fs = require('fs/promises');
const path = require('path');
const router = require('express').Router();
const { query } = require('shared/db');
const { asyncHandler } = require('shared/errors');
const { internalOnly } = require('shared/auth');
const { FILES_DIR } = require('./storage');

router.use(internalOnly);

// Elimina la foto y los adjuntos de tareas de una persona (lo invoca user-service al borrarla).
// Los documentos del repositorio y las portadas de publicaciones se conservan (owner_id pasa a NULL).
router.delete('/users/:id(\\d+)/files', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await query("SELECT id, stored_name FROM files WHERE owner_id = $1 AND context IN ('avatar','task')", [id]);
  await query("DELETE FROM files WHERE owner_id = $1 AND context IN ('avatar','task')", [id]);
  await Promise.all(rows.map((f) => fs.rm(path.join(FILES_DIR, f.stored_name), { force: true }).catch(() => {})));
  res.json({ deleted: rows.length });
}));

module.exports = router;
