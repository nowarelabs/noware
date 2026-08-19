import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, point the SPA at the dashboard-api worker (wrangler dev). It proxies
// /agents/* through to the orchestrator and serves the REST + GitHub routes.
const dashboardOrigin = process.env.DASHBOARD_ORIGIN ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/agents': { target: dashboardOrigin, changeOrigin: true },
      '/api': { target: dashboardOrigin, changeOrigin: true },
    },
  },
});
