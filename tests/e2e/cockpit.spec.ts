import { expect, test } from '@playwright/test';

// The detailed cabin (F04-T01-FIX02) renders slowly on software WebGL: the default 30 s per test ran out on a slower
// CI runner while the same build passed on another one.
test.describe.configure({ timeout: 90_000 });

test('prepares the cabin, observes and restores the initial state', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/pista');
  const view = page.getByTestId('driving-canvas');
  await expect(view).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await view.scrollIntoViewIfNeeded();
  await view.screenshot({ path: testInfo.outputPath('cockpit-front.png') });
  await page.getByRole('button', { name: 'Cinturón', exact: false }).first().click();
  await expect(page.getByText('Cinturón abrochado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mirar a la izquierda', exact: true }).click();
  await expect(view).toHaveAttribute('data-look-yaw', '1.3');
  await view.screenshot({ path: testInfo.outputPath('cockpit-left.png') });
  await page.getByRole('button', { name: 'Mirar al frente', exact: true }).click();
  await page.getByText('Prepará tu posición', { exact: true }).click();
  await page.getByRole('slider', { name: 'Altura del asiento', exact: true }).fill('0.8');
  await page.getByRole('slider', { name: 'Izquierdo: Orientación horizontal', exact: true }).fill('0.2');
  await page.getByRole('button', { name: 'Volver al inicio', exact: true }).click();
  await expect(page.getByText('Cinturón sin abrochar', { exact: true })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Altura del asiento', exact: true })).toHaveValue('0.5');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('rebinds the key command and retains it after reload', async ({ page }) => {
  await page.goto('/#/pista');
  const view = page.getByTestId('driving-canvas');
  await expect(view).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await page.getByText('Configurar teclado', { exact: true }).click();
  const binding = page.getByRole('button', { name: 'Accionar llave K', exact: true });
  await binding.click();
  await page.keyboard.press('Digit1');
  await view.focus();
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Digit1');
  await expect(view).toHaveAttribute('data-engine', 'running');
  await page.reload();
  await expect(view).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await view.focus();
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Digit1');
  await expect(view).toHaveAttribute('data-engine', 'running');
});

test('records frame timing within a bounded sample window', async ({ page }, testInfo) => {
  await page.goto('/#/pista');
  const view = page.getByTestId('driving-canvas');
  await expect(view).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await view.scrollIntoViewIfNeeded();
  const timing = await page.evaluate(async () => {
    const samples: number[] = [];
    const started = performance.now();
    let previous = started;
    for (let index = 0; index < 60 && performance.now() - started < 5000; index++) {
      const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      samples.push(now - previous);
      previous = now;
    }
    samples.sort((a, b) => a - b);
    return {
      frames: samples.length,
      elapsedMs: performance.now() - started,
      sampleBudgetMs: 5000,
      meanMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
      p95Ms: samples[Math.ceil(samples.length * 0.95) - 1],
      userAgent: navigator.userAgent,
      dpr: devicePixelRatio,
      width: innerWidth,
      height: innerHeight,
    };
  });
  await testInfo.attach('frame-timing', { body: JSON.stringify(timing), contentType: 'application/json' });
  expect(timing.frames).toBeGreaterThan(0);
  expect(timing.meanMs).toBeGreaterThan(0);
});
