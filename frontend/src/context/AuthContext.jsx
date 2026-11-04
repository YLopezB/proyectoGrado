import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler, setPasswordChangeHandler } from '../api/client.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const can = (user, perm) => !!user && (user.role === 'admin' || user.perms?.includes(perm));
export const homeFor = (user) => {
  if (!user) return '/login';
  if (user.mustChange) return '/cambiar-clave';
  return user.role === 'admin' ? '/admin/usuarios' : '/';
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    setPasswordChangeHandler(() => setUser((u) => (u ? { ...u, mustChange: true } : u)));
  }, [logout]);

  // Restaura la sesión al recargar la página
  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    const d = await api.get('/auth/me');
    setUser(d.user);
    return d.user;
  }, []);

  const login = useCallback(async (identifier, password) => {
    const d = await api.post('/auth/login', { identifier, password });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const d = await api.post('/auth/change-password', { currentPassword, newPassword });
    setToken(d.token); // el nuevo token ya no exige cambio de contraseña
    setUser(d.user);
    return d.user;
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refresh, changePassword }), [user, loading, login, logout, refresh, changePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
