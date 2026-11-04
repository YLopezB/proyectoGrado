const path = require('path');

const DATA_DIR = process.env.DATA_DIR || '/data';
module.exports = {
  DATA_DIR,
  FILES_DIR: path.join(DATA_DIR, 'files'),
  TMP_DIR: path.join(DATA_DIR, 'tmp'),
  MAX_FILE_BYTES: Number(process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024,
  USER_QUOTA_BYTES: Number(process.env.USER_QUOTA_MB || 500) * 1024 * 1024,
  BLOCKED_EXT: (process.env.BLOCKED_EXTENSIONS || 'exe,msi,bat,cmd,com,scr,vbs,ps1,jar,dll')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
};
