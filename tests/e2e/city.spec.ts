import { expect, test } from '@playwright/test';

test('explores all eight legs, opens sources and preserves the geographic overview without overflow', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/recorrido');
  const preview = page.getByTestId('city-preview');
  await expect(preview).toHaveAttribute('data-state', 'ready');
  const selector = page.getByRole('combobox', { name: 'Punto de entrada' });
  for (let leg = 1; leg <= 8; leg++) {
    await selector.selectOption(String(leg));
    await expect(preview).toHaveAttribute('data-state', 'ready');
    expect(Number(await preview.getAttribute('data-sectors'))).toBeGreaterThan(0);
  }
  await selector.selectOption('1');
  await expect(preview).toHaveAttribute('data-state', 'ready');
  await preview.screenshot({ path: testInfo.outputPath('quesada-block.png') });
  await page.getByRole('button', { name: 'Ver circuito completo', exact: true }).click();
  await expect(preview).toHaveAttribute('data-state', 'ready');
  await expect
    .poll(async () => preview.getAttribute('data-sectors'))
    .toBe(await preview.getAttribute('data-total-sectors'));
  await preview.screenshot({ path: testInfo.outputPath('complete-route.png') });
  await page.getByText('Fuentes y verificación', { exact: true }).click();
  await expect(
    page.getByText('Anchos, veredas, fachadas y posición de entrada son aproximaciones.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lámina oficial · recorridos, página 16' })).toHaveAttribute(
    'href',
    '#/biblioteca/recorridos/16',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('drives from a route entry with the keyboard and restores the parked state', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await page.goto('/#/recorrido');
  await expect(page.getByTestId('city-preview')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Conducir este tramo', exact: true }).click();
  const view = page.getByTestId('driving-canvas');
  await expect(view).toHaveAttribute('data-state', 'ready');
  const initialX = await view.getAttribute('data-position-x');
  const initialZ = await view.getAttribute('data-position-z');
  await view.scrollIntoViewIfNeeded();
  await view.screenshot({ path: testInfo.outputPath('route-cockpit.png') });
  await view.focus();
  await page.keyboard.press('KeyK');
  await page.keyboard.press('KeyK');
  await expect(view).toHaveAttribute('data-engine', 'running');
  await page.keyboard.down('ArrowDown');
  const before = Number(await view.getAttribute('data-time-s'));
  await expect
    .poll(async () => Number(await view.getAttribute('data-time-s')), { timeout: 15000 })
    .toBeGreaterThan(before + 0.5);
  for (const gear of ['R', 'N', 'D1']) {
    await page.keyboard.press('KeyE');
    await expect(view).toHaveAttribute('data-gear', gear);
  }
  await page.keyboard.press('Space');
  await page.keyboard.up('ArrowDown');
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => Number(await view.getAttribute('data-odometer-m')), { timeout: 20000 })
    .toBeGreaterThan(3);
  await page.keyboard.up('ArrowUp');
  await page.getByRole('button', { name: 'Volver al punto de entrada', exact: true }).click();
  await expect(view).toHaveAttribute('data-engine', 'off');
  await expect(view).toHaveAttribute('data-position-x', initialX ?? '');
  await expect(view).toHaveAttribute('data-position-z', initialZ ?? '');
  await expect(view).toHaveAttribute('data-odometer-m', '0.00');
});

test('records cockpit frame timing and renderer environment within a bounded window', async ({ page }, testInfo) => {
  await page.goto('/#/recorrido');
  await expect(page.getByTestId('city-preview')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: 'Conducir este tramo', exact: true }).click();
  await expect(page.getByTestId('driving-canvas')).toHaveAttribute('data-state', 'ready');
  const timing = await page.evaluate(async () => {
    const view = document.querySelector<HTMLElement>('[data-testid="driving-canvas"]');
    const gl = view?.querySelector('canvas')?.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    const samples: number[] = [];
    const start = performance.now();
    let last = start;
    while (samples.length < 60 && performance.now() - start < 5000) {
      const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      samples.push(now - last);
      last = now;
    }
    samples.sort((a, b) => a - b);
    return {
      frames: samples.length,
      meanMs: samples.reduce((sum, v) => sum + v, 0) / samples.length,
      p95Ms: samples[Math.ceil(samples.length * 0.95) - 1],
      elapsedMs: performance.now() - start,
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
      userAgent: navigator.userAgent,
      gpu: gl && debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'unavailable',
      activeSectors: view?.dataset.sectors,
    };
  });
  await testInfo.attach('city-frame-timing', { body: JSON.stringify(timing), contentType: 'application/json' });
  expect(timing.frames).toBeGreaterThan(0);
});
