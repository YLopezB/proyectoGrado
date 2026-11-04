import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Directorio de personas activas (se comparte entre pantallas y se refresca cada minuto)
let cache = { at: 0, data: null, promise: null };
export function loadDirectory(force = false) {
  if (!force && cache.data && Date.now() - cache.at < 60_000) return Promise.resolve(cache.data);
  if (!cache.promise) {
    cache.promise = api.get('/users/directory').then((d) => { cache = { at: Date.now(), data: d, promise: null }; return d; })
      .catch((e) => { cache.promise = null; throw e; });
  }
  return cache.promise;
}
export const invalidateDirectory = () => { cache = { at: 0, data: null, promise: null }; };

export function useDirectory() {
  const [people, setPeople] = useState(cache.data || []);
  const [loading, setLoading] = useState(!cache.data);
  useEffect(() => {
    let alive = true;
    loadDirectory().then((d) => { if (alive) { setPeople(d); setLoading(false); } }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);
  return { people, loading };
}
