const TOKEN_KEY = 'plataforma.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

let onUnauthorized = () => {};
let onPasswordChangeRequired = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
export const setPasswordChangeHandler = (fn) => { onPasswordChangeRequired = fn; };

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const authHeader = () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {});

function handleFailure(res, data, path) {
  if (res.status === 401 && path !== '/auth/login') onUnauthorized();
  if (res.status === 403 && data?.code === 'PASSWORD_CHANGE_REQUIRED') onPasswordChangeRequired();
  throw new ApiError(data?.error || `Error ${res.status}`, res.status, data?.code);
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { ...authHeader(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.', 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) handleFailure(res, data, path);
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body = {}) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),

  // Descarga autenticada (los archivos requieren el token, no se pueden usar <a href> directos)
  async blob(path) {
    let res;
    try { res = await fetch(`/api${path}`, { headers: authHeader() }); }
    catch { throw new ApiError('No se pudo conectar con el servidor.', 0); }
    if (!res.ok) handleFailure(res, await res.json().catch(() => null), path);
    return { blob: await res.blob(), type: res.headers.get('Content-Type') || '' };
  },

  // Subida con progreso (fetch aún no expone el progreso de subida)
  upload(path, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api${path}`);
      if (getToken()) xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onerror = () => reject(new ApiError('Falló la conexión durante la subida.', 0));
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch { /* sin cuerpo JSON */ }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
        if (xhr.status === 401) onUnauthorized();
        if (xhr.status === 403 && data?.code === 'PASSWORD_CHANGE_REQUIRED') onPasswordChangeRequired();
        reject(new ApiError(data?.error || (xhr.status === 413 ? 'El archivo es demasiado grande.' : `Error ${xhr.status}`), xhr.status, data?.code));
      };
      xhr.send(formData);
    });
  },
};

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
