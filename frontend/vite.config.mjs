// Author: Jonathan Kakesa (JonathanK-N).
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'REACT_APP_'), ...process.env };
  const publicKeys = ['REACT_APP_BACKEND_URL', 'REACT_APP_FCM_VAPID_KEY', 'REACT_APP_FIREBASE_CONFIG'];
  const define = Object.fromEntries(publicKeys.map(key => ['process.env.' + key, JSON.stringify(env[key] || '')]));
  return {
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define,
    build: { outDir: 'build', sourcemap: false },
    server: { host: '127.0.0.1' },
  };
});
