import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En Docker (desarrollo) el navegador entra por el gateway nginx (puerto DEV_HTTP_PORT),
// por eso el HMR de Vite debe conectarse a ese puerto y no al 5173.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    watch: { usePolling: true }, // necesario para detectar cambios en volúmenes Docker (Windows/macOS)
    hmr: { clientPort: Number(process.env.VITE_HMR_CLIENT_PORT || 8080) },
    // Solo se usa si ejecutas `npm run dev` fuera de Docker: reenvía el API al gateway
    proxy: {
      '/api': process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
      '/socket.io': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080', ws: true },
    },
  },
});
