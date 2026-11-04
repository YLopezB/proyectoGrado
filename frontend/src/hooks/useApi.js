import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

// Carga un recurso del API. Si path es null no hace nada. reload() vuelve a pedirlo.
export function useApi(path, { initial = null } = {}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) { setLoading(false); return null; }
    const mine = ++seq.current;
    setLoading(true);
    try {
      const d = await api.get(path);
      if (mine === seq.current) { setData(d); setError(null); }
      return d;
    } catch (e) {
      if (mine === seq.current) setError(e);
      return null;
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
