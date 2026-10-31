import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: Object.fromEntries(
        ['/api', '/healthz'].map((path) => [
          path,
          { target: env.API_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true, ws: true },
        ]),
      ),
    },
  };
});
