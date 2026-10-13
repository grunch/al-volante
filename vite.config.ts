/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The largest precached file is the lazily loaded 3D chunk (about 1.66 MB minified); Workbox skips, with only a build
 * warning, any file above this limit, so it sits just above that chunk. tests/e2e/pwa.spec.ts fails if a built file is
 * left out of the precache.
 */
const MAX_PRECACHED_FILE_BYTES = 1_800_000;

// Relative base so the build works from any static host or sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // A new version waits for the player's consent; src/pwa registers the worker and shows the prompt.
      registerType: 'prompt',
      injectRegister: false,
      // The icons are already in the glob below; listing them twice would only inflate the reported size.
      includeManifestIcons: false,
      manifest: {
        id: './',
        name: 'Al volante: Comuna 13',
        short_name: 'Al volante',
        description:
          'Juego para preparar el examen de licencia B en CABA: teoría, señales y práctica en el recorrido de Comuna 13.',
        lang: 'es-AR',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#13233a',
        background_color: '#f7f2e8',
        categories: ['education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell, every JS/CSS chunk (content catalogs and 3D included), the icons and the figure and sign
        // crops. The plugin adds manifest.webmanifest itself.
        globPatterns: ['**/*.{html,js,css,png,svg}'],
        // Source maps are for debugging only and would double the download.
        globIgnores: ['**/*.map'],
        maximumFileSizeToCacheInBytes: MAX_PRECACHED_FILE_BYTES,
        // Hash routes always load index.html; any other navigation inside the scope falls back to it offline.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // The first visit is controlled as soon as the cache is ready, so its lazy chunks also load offline.
        // Updates still wait: there is no skipWaiting until the player accepts.
        clientsClaim: true,
      },
    }),
  ],
  build: {
    target: 'es2023',
    sourcemap: true,
    // The lazily loaded Three.js chunk is ~530 kB minified on its own; the app shell stays far below this.
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      // Kept a little below the measured coverage (REV01-T02: 99.4 % statements, 97.2 % branches) so it cannot drift down.
      thresholds: { lines: 99, functions: 99, branches: 96, statements: 99 },
    },
  },
});
