/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any static host or sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
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
