import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  publicDir: path.join(root, 'public'),
  build: { outDir: path.resolve(root, '../dist/web'), emptyOutDir: true, sourcemap: false, target: 'es2022' },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000', '/media': 'http://localhost:3000' },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'theme.js'],
      manifest: {
        id: '/',
        name: 'Lapis – Schreib es los',
        short_name: 'Lapis',
        description: 'Ein Ort zum Aufschreiben: Tagebuch, Momente, Geschichten, Gedichte und Briefe.',
        lang: 'de',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        theme_color: '#F7F4F0',
        background_color: '#F7F4F0',
        categories: ['social', 'lifestyle', 'books'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Schreiben', short_name: 'Schreiben', url: '/schreiben', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Mein Tagebuch', short_name: 'Tagebuch', url: '/tagebuch', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Impuls des Tages', short_name: 'Impuls', url: '/impulse', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
        // Aus anderen Apps Text oder Links direkt in Lapis teilen.
        share_target: { action: '/schreiben', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Nur lateinische Schriftschnitte vorladen; andere Schriften lädt der Browser bei Bedarf.
        globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET' && !url.pathname.startsWith('/api/auth/export'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'lapis-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 300, maxAgeSeconds: 7 * 86400 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/media/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lapis-media',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
