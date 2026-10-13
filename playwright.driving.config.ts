import { defineConfig, devices } from '@playwright/test';

/** An opt-in driving session: real controls, renderer and physics, with read-only development telemetry. */
export default defineConfig({
  testDir: './tests/playtest',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 1_200_000,
  expect: { timeout: 30_000 },
  outputDir: './test-results/driving',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/driving', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    baseURL: 'http://127.0.0.1:4197',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false, sources: true },
    launchOptions: process.env.DRIVING_GPU === '1' ? { args: ['--enable-gpu', '--use-angle=gl'] } : {},
  },
  webServer: {
    command: 'npm run dev -- --port 4197 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4197',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
