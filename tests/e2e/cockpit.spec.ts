import { expect, test } from '@playwright/test';

test('prepares the cabin, observes and restores the initial state', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/pista');
  const view = page.getByTestId('driving-canvas');
  await expect(view).toHaveAttribute('data-state', 'ready');
  await view.scrollIntoViewIfNeeded();
  await view.screenshot({ path: testInfo.outputPath('cockpit-front.png') });
  const timing = await page.evaluate(async () => {
    const samples: number[] = [];
    let previous = performance.now();
    for (let index = 0; index < 60; index++) {
      const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      samples.push(now - previous);
      previous = now;
    }
    samples.sort((a, b) => a - b);
    return {
      frames: samples.length,
      meanMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
      p95Ms: samples[56],
      userAgent: navigator.userAgent,
      dpr: devicePixelRatio,
      width: innerWidth,
      height: innerHeight,
    };
  });
  await testInfo.attach('frame-timing', { body: JSON.stringify(timing), contentType: 'application/json' });

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
  await expect(view).toHaveAttribute('data-state', 'ready');
  await page.getByText('Configurar teclado', { exact: true }).click();
  const binding = page.getByRole('button', { name: 'Accionar llave KeyK', exact: true });
  await binding.click();
  await page.keyboard.press('Digit1');
  await view.focus();
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Digit1');
  await expect(view).toHaveAttribute('data-engine', 'running');
  await page.reload();
  await expect(view).toHaveAttribute('data-state', 'ready');
  await view.focus();
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Digit1');
  await expect(view).toHaveAttribute('data-engine', 'running');
});
