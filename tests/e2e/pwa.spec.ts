import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { APIResponse, Page } from '@playwright/test';

// The other specs block service workers to stay fast; these ones install the app as a player would.
test.use({ serviceWorkers: 'allow' });
// The worker, the cache and the manifest are the same in both projects; precaching ~19 MB twice adds nothing.
test.skip(({ isMobile }) => isMobile, 'Covered by the desktop project');
// Installing downloads the whole precache; CI runners (software WebGL, shared CPU) need more than the default 30 s.
test.describe.configure({ timeout: 90_000 });

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const CONCEPT = 'Ceder el paso a peatones al girar con luz verde';
const OFFLINE_READY = 'Listo: la app ya funciona sin conexión en este dispositivo.';

/** Width and height from the IHDR chunk of a PNG. */
async function pngSize(response: APIResponse) {
  const bytes = await response.body();
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

/** First visit: waits until the worker has cached the app and controls the page. */
async function installApp(page: Page) {
  await page.goto('./');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 60_000 });
  await expect(page.getByRole('status').filter({ hasText: OFFLINE_READY })).toBeVisible();
  await page.getByRole('button', { name: 'Entendido' }).click();
}

/** Every file of the build the app needs: everything but source maps and the worker itself. */
function builtFiles(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [relative(DIST, join(dir, entry.name)).split(sep).join('/')],
    );
  return walk(DIST).filter((file) => !file.endsWith('.map') && !/^(sw|workbox-[\w-]+)\.js$/.test(file));
}

test.describe('installable app', () => {
  test('serves a valid web app manifest whose icons load with their declared sizes', async ({ page, request }) => {
    await page.goto('./');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifestUrl = new URL(manifestHref ?? '', page.url());

    const response = await request.get(manifestUrl.href);
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      name: 'Al volante: Comuna 13',
      short_name: 'Al volante',
      lang: 'es-AR',
      start_url: './',
      scope: './',
      display: 'standalone',
      theme_color: '#13233a',
      categories: ['education'],
    });
    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string; purpose: string }>;
    expect(icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual([
      '192x192 any',
      '512x512 any',
      '512x512 maskable',
    ]);
    for (const icon of icons) {
      const image = await request.get(new URL(icon.src, manifestUrl).href);
      expect(image.status(), icon.src).toBe(200);
      expect(image.headers()['content-type']).toBe('image/png');
      expect(await pngSize(image), icon.src).toBe(icon.sizes);
    }
    const appleHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(await pngSize(await request.get(new URL(appleHref ?? '', page.url()).href))).toBe('180x180');
    const favicon = await request.get(new URL('favicon.svg', page.url()).href);
    expect(favicon.status()).toBe(200);
  });

  test('installs a worker that precaches the whole build and keeps working offline', async ({ page, context }) => {
    // Arrange: the first visit caches everything.
    await installApp(page);
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(request.url);
      }
      return urls;
    });
    const cachedFiles = new Set(cached.map((url) => decodeURIComponent(new URL(url).pathname).replace(/^\//, '')));
    expect(builtFiles().filter((file) => !cachedFiles.has(file))).toEqual([]);

    // Act: no network at all from here on.
    await context.setOffline(true);
    await page.reload();

    // Assert: home, with the 3D garage (a lazy chunk) and the offline indicator.
    await expect(page.getByRole('heading', { level: 1, name: 'Mi garaje' })).toBeVisible();
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await expect(page.getByRole('status').filter({ hasText: /^Sin conexión\./ })).toBeVisible();
    await expect(page.getByTestId('garage-scene')).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });

    // An activity with a sign cropped from the manual (public/signs).
    await page.goto('./#/actividad/act.signs-warn-curves-slopes?semilla=0');
    const sign = page.getByRole('img', { name: /^Señal a identificar: / });
    await expect(sign).toBeVisible();
    expect(await sign.evaluate((image: HTMLImageElement) => [image.tagName, image.naturalWidth > 0])).toEqual([
      'IMG',
      true,
    ]);

    // The library text of a page (a lazy content chunk), reloaded on its deep link; only the PDF needs internet.
    await page.goto('./#/biblioteca/manual/72');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /^Página 72 · Manual/ })).toBeVisible();
    await expect(page.locator('pre.extracted-text')).not.toBeEmpty();
    await expect(
      page.getByRole('link', { name: 'Abrir el PDF oficial en esta página (necesita conexión)' }),
    ).toBeVisible();

    // The theory exam.
    await page.goto('./#/examen/teorico?semilla=1');
    await page.getByRole('button', { name: 'Empezar el simulacro' }).click();
    await expect(page.getByRole('radio')).toHaveCount(120);

    await context.setOffline(false);
    await expect(page.getByRole('status').filter({ hasText: /^Sin conexión\./ })).toHaveCount(0);
  });

  test('offers a new version without reloading, and keeps the progress when the player accepts it', async ({
    page,
  }) => {
    // Arrange: an installed app with one answer stored in IndexedDB.
    await installApp(page);
    await page.goto('./#/actividad/act.turn-with-pedestrian?semilla=0');
    await page.getByRole('button', { name: /30 m antes enciendo la luz de giro/ }).click();
    await page.getByRole('button', { name: 'Freno y le cedo el paso, aunque tenga verde' }).click();
    await expect(page.getByRole('heading', { name: '¡Correcto!' })).toBeVisible();
    await page.goto('./#/bitacora');
    const concept = page.getByRole('region', { name: 'Campaña licencia B' }).getByRole('link', { name: CONCEPT });
    await expect(concept).toBeVisible();
    await page.evaluate(() => Object.assign(window, { sameDocument: true }));

    // Act: a new version appears. The browser installs a worker registered under another script URL even when its
    // bytes are equal, which stands in for a new deployment (Playwright cannot rewrite the worker script request).
    await page.evaluate(() => navigator.serviceWorker.register('./sw.js?e2e-update=1', { scope: './' }));

    // Assert: it waits for the player, and nothing reloads on its own.
    const prompt = page.getByRole('region', { name: /^Hay una versión nueva\./ });
    await expect(prompt).toBeVisible();
    expect(
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return {
          waiting: registration?.waiting?.scriptURL.includes('e2e-update') ?? false,
          controller: navigator.serviceWorker.controller?.scriptURL.includes('e2e-update') ?? true,
          sameDocument: 'sameDocument' in window,
        };
      }),
    ).toEqual({ waiting: true, controller: false, sameDocument: true });

    // «Actualizar» activates it and reloads this page, and the stored progress is still there.
    await Promise.all([page.waitForEvent('load'), prompt.getByRole('button', { name: 'Actualizar' }).click()]);
    await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes('e2e-update'));
    expect(await page.evaluate(() => 'sameDocument' in window)).toBe(false);
    await expect(concept).toBeVisible();
  });
});

test.describe('installable app where the browser refuses the service worker', () => {
  test.use({ serviceWorkers: 'block' });

  test('says that offline use could not be prepared, never claims it, and retries on request', async ({
    page,
    context,
  }) => {
    // Arrange
    const failures: string[] = [];
    page.on('console', (message) => {
      if (message.text().startsWith('Service worker registration failed')) failures.push(message.text());
    });

    // Act
    await page.goto('./');
    const notice = page.getByRole('region', { name: /^No se pudo preparar la app para usarla sin conexión\./ });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: 'Reintentar' }).click();
    await expect.poll(() => failures.length).toBe(2);
    await context.setOffline(true);

    // Assert
    await expect(notice).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /^Sin conexión\./ })).toContainText(
      'todavía no quedó guardada',
    );
    await expect(page.getByText(OFFLINE_READY)).toHaveCount(0);
  });
});
