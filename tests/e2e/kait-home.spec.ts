import { expect, test } from '@playwright/test';

test('loads the Blender Kait and keeps it visible on a reduced-motion home page', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const asset = page.waitForResponse((response) => /\/kait[^/]*\.glb(?:\?|$)/.test(response.url()));
  await page.goto('./');
  const response = await asset;
  expect(response.ok()).toBe(true);
  const bytes = await response.body();
  expect(bytes.subarray(0, 4).toString()).toBe('glTF');
  expect(bytes.byteLength).toBeLessThan(4_000_000);
  const scene = page.getByRole('img', { name: 'Vista 3D del Nissan Kait en el garaje' });
  await expect(scene).toBeVisible({ timeout: 15_000 });
  await expect(scene).toHaveAttribute('data-state', 'ready');
  const before = await scene.screenshot({ path: testInfo.outputPath('kait-home.png') });
  await page.waitForTimeout(350);
  expect(await scene.screenshot()).toEqual(before);
  expect(errors).toEqual([]);
});

test('keeps navigation usable when the model download fails', async ({ page }) => {
  await page.route('**/*kait*.glb*', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('./');
  const scene = page.getByTestId('garage-scene');
  await expect(scene).toHaveAttribute('data-state', 'unavailable');
  await expect(scene.getByRole('status')).toHaveText(
    'No pudimos cargar el garaje 3D. Podés seguir usando la parte teórica sin problemas.',
  );
  await expect(scene.locator('canvas')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Biblioteca' }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
});

test('does not attach a late model after navigating away', async ({ page }) => {
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*kait*.glb*', async (route) => {
    requested();
    await blocked;
    await route.abort();
  });
  await page.goto('./');
  await started;
  await expect(page.getByTestId('garage-scene')).toHaveAttribute('data-state', 'loading');
  await page.getByRole('navigation').getByRole('link', { name: 'Biblioteca' }).click();
  release();
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  await expect(page.getByTestId('garage-scene')).toHaveCount(0);
});
