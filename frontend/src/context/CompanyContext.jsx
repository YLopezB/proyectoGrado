import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CompanyContext = createContext(null);
export const useCompany = () => useContext(CompanyContext);

const DEFAULT = {
  name: 'Nombre empresa', slogan: 'Eslogan empresarial', primaryColor: '#184f5b', accentColor: '#e8f0f0',
  hasLogo: false, hasLoginBg: false, version: '0', loginText: '', helpUrl: '', developerName: '', developerUrl: '', appVersion: '1.0.0',
};

// Carga la marca (nombre, eslogan, colores, logo) desde el servidor y la aplica como variables CSS
export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(DEFAULT);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/company', { cache: 'no-store' });
      if (r.ok) setCompany({ ...DEFAULT, ...(await r.json()) });
    } catch { /* se usan los valores por defecto */ }
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--brand', company.primaryColor);
    root.setProperty('--tint', company.accentColor);
    document.title = company.name;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', company.primaryColor);
  }, [company]);

  const value = useMemo(() => ({
    ...company, ready, reload: load,
    logoUrl: company.hasLogo ? `/api/company/logo?v=${company.version}` : '/img/logo.svg',
    loginBgUrl: company.hasLoginBg ? `/api/company/login-bg?v=${company.version}` : '/img/login-bg.jpg',
  }), [company, ready, load]);
  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}
