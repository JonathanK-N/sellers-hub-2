// Author: Jonathan Kakesa (JonathanK-N).
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

function inlineEntryStyles() {
  return {
    name: 'afrimarket-entry-styles',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.bundle) return html;
        const fonts = readFileSync(new URL('./public/fonts/poppins.css', import.meta.url), 'utf8');
        html = html.replace('<link rel="stylesheet" href="/fonts/poppins.css" />', `<style data-afrimarket-fonts>${fonts}</style>`);
        return html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, tag => {
          const href = tag.match(/href="([^"]+)"/)?.[1];
          const asset = href && context.bundle[href.replace(/^\//, '')];
          if (!asset || asset.type !== 'asset' || !href.endsWith('.css')) return tag;
          // Preserve the compiled stylesheet exactly; keep its asset for offline and lazy imports.
          return `<style data-afrimarket-entry>${asset.source}</style>`;
        });
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'REACT_APP_'), ...process.env };
  const publicKeys = ['REACT_APP_BACKEND_URL', 'REACT_APP_FCM_VAPID_KEY', 'REACT_APP_FIREBASE_CONFIG'];
  const define = Object.fromEntries(publicKeys.map(key => ['process.env.' + key, JSON.stringify(env[key] || '')]));
  return {
    plugins: [react(), tailwindcss(), inlineEntryStyles()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define,
    build: { outDir: 'build', sourcemap: false },
    server: { host: '127.0.0.1' },
  };
});
