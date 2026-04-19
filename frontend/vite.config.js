import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Must match backend PORT (see backend/.env). Avoid 5000 on macOS — AirPlay Receiver often grabs it and returns 403 to POST /api.
  const backendOrigin = env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:5001';

  const proxy = {
    '/api': {
      target: backendOrigin,
      changeOrigin: true,
      secure: false
    }
  };

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 3000,
      proxy
    },
    preview: {
      host: '127.0.0.1',
      port: 3000,
      proxy
    }
  };
});
