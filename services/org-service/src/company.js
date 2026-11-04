// Configuración de la empresa: valores por defecto del .env, editables por el administrador.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const router = require('express').Router();
const multer = require('multer');
const { query } = require('shared/db');
const { HttpError, asyncHandler } = require('shared/errors');
const { authenticate, requirePerm } = require('shared/auth');

const DIR = path.join(process.env.DATA_DIR || '/data', 'company');
const IMG_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const HEX = /^#[0-9a-fA-F]{6}$/;

const env = () => ({
  name: process.env.COMPANY_NAME || 'Nombre empresa',
  slogan: process.env.COMPANY_SLOGAN || 'Eslogan empresarial',
  primaryColor: process.env.COMPANY_PRIMARY_COLOR || '#184f5b',
  accentColor: process.env.COMPANY_ACCENT_COLOR || '#e8f0f0',
});

async function load() {
  const d = env();
  const { rows } = await query('SELECT * FROM company WHERE id = 1');
  const r = rows[0] || {};
  return {
    name: r.name || d.name,
    slogan: r.slogan || d.slogan,
    primaryColor: r.primary_color || d.primaryColor,
    accentColor: r.accent_color || d.accentColor,
    logoFile: r.logo_file || null,
    loginBgFile: r.login_bg_file || null,
    version: String(r.updated_at ? new Date(r.updated_at).getTime() : 0),
  };
}

const publicShape = (c) => ({
  name: c.name, slogan: c.slogan, primaryColor: c.primaryColor, accentColor: c.accentColor,
  hasLogo: !!c.logoFile, hasLoginBg: !!c.loginBgFile, version: c.version,
  loginText: process.env.COMPANY_LOGIN_TEXT || 'Una solución simple a la comunicación de tu organización',
  helpUrl: process.env.HELP_URL || '',
  developerName: process.env.DEVELOPER_NAME || 'Yeison Andres López Burbano',
  developerUrl: process.env.DEVELOPER_URL || '',
  appVersion: process.env.APP_VERSION || '1.0.0',
});

// Público: lo necesita la pantalla de inicio de sesión
router.get('/', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json(publicShape(await load()));
}));

const serve = (field) => asyncHandler(async (req, res) => {
  const c = await load();
  const file = c[field];
  if (!file) throw new HttpError(404, 'No hay imagen personalizada');
  const p = path.join(DIR, path.basename(file));
  if (!fs.existsSync(p)) throw new HttpError(404, 'No hay imagen personalizada');
  res.setHeader('Content-Type', IMG_TYPES[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  fs.createReadStream(p).on('error', () => res.destroy()).pipe(res);
});
router.get('/logo', serve('logoFile'));
router.get('/login-bg', serve('loginBgFile'));

const upload = multer({
  storage: multer.diskStorage({ destination: (r, f, cb) => cb(null, DIR), filename: (r, f, cb) => cb(null, `tmp-${crypto.randomUUID()}`) }),
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => (IMG_TYPES[path.extname(file.originalname).toLowerCase()]
    ? cb(null, true) : cb(new HttpError(400, 'Formato de imagen no permitido (usa PNG, JPG, WEBP o SVG)'))),
});

// PUT /api/company  multipart: name, slogan, primaryColor, accentColor, logo, loginBg, removeLogo, removeLoginBg
router.put('/', authenticate(), requirePerm('admin'), (req, res, next) => {
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'loginBg', maxCount: 1 }])(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'Las imágenes pueden pesar máximo 10 MB'));
    next(err);
  });
}, asyncHandler(async (req, res) => {
  const tmp = Object.values(req.files || {}).flat();
  const rm = (p) => fsp.rm(p, { force: true }).catch(() => {});
  try {
    const b = req.body || {};
    const cur = await load();
    const next = { ...cur };
    if (b.name !== undefined) {
      const v = String(b.name).trim();
      if (!v || v.length > 120) throw new HttpError(400, 'El nombre de la empresa es obligatorio (máx. 120 caracteres)');
      next.name = v;
    }
    if (b.slogan !== undefined) {
      const v = String(b.slogan).trim();
      if (v.length > 200) throw new HttpError(400, 'El eslogan es demasiado largo (máx. 200)');
      next.slogan = v || env().slogan;
    }
    for (const [k, label] of [['primaryColor', 'principal'], ['accentColor', 'de acento']]) {
      if (b[k] !== undefined) {
        if (!HEX.test(b[k])) throw new HttpError(400, `El color ${label} debe tener formato #RRGGBB`);
        next[k] = b[k].toLowerCase();
      }
    }
    const old = [];
    const replace = (field, f, remove) => {
      if (f) {
        const ext = path.extname(f.originalname).toLowerCase();
        const stored = `${field === 'logoFile' ? 'logo' : 'login-bg'}-${crypto.randomUUID()}${ext}`;
        fs.renameSync(f.path, path.join(DIR, stored));
        if (cur[field]) old.push(cur[field]);
        next[field] = stored;
      } else if (remove === 'true' && cur[field]) {
        old.push(cur[field]);
        next[field] = null;
      }
    };
    replace('logoFile', req.files?.logo?.[0], b.removeLogo);
    replace('loginBgFile', req.files?.loginBg?.[0], b.removeLoginBg);

    await query(
      `INSERT INTO company (id, name, slogan, primary_color, accent_color, logo_file, login_bg_file, updated_at)
       VALUES (1,$1,$2,$3,$4,$5,$6, now())
       ON CONFLICT (id) DO UPDATE SET name = $1, slogan = $2, primary_color = $3, accent_color = $4,
         logo_file = $5, login_bg_file = $6, updated_at = now()`,
      [next.name, next.slogan, next.primaryColor, next.accentColor, next.logoFile, next.loginBgFile],
    );
    await Promise.all(old.map((f) => rm(path.join(DIR, path.basename(f)))));
    res.json(publicShape(await load()));
  } finally {
    await Promise.all(tmp.map((f) => rm(f.path))); // sobrantes (validación fallida o ya movidos)
  }
}));

module.exports = router;
