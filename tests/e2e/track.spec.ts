import { expect, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';

const readout = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator('xpath=following-sibling::dd');

async function openYard(page: Page): Promise<Locator> {
  await page.goto('./#/pista');
  const canvas = page.getByRole('application', { name: /Vista 3D de la pista de prueba/ });
  await expect(canvas).toHaveAttribute('data-state', 'ready');
  return canvas;
}

async function waitForSimulation(canvas: Locator, seconds: number) {
  const started = Number(await canvas.getAttribute('data-time-s'));
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-time-s')), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(started + seconds);
}

async function press(page: Page, canvas: Locator, key: string) {
  await page.keyboard.press(key);
  // Commands are consumed by the render loop; do not assume a particular wall-clock frame duration.
  await waitForSimulation(canvas, 0.01);
}

test.describe('practice yard', () => {
  test.describe.configure({ timeout: 60_000 });
  test('automatic: starts in P, goes to D with the brake held and creeps off once the brake is released', async ({
    page,
  }) => {
    await page.goto('./#/pista');
    await page.getByRole('radio', { name: 'Automática' }).check();
    const canvas = page.getByRole('application', { name: /Vista 3D de la pista de prueba/ });
    await expect(canvas).toHaveAttribute('data-state', 'ready');
    await canvas.focus();

    await press(page, canvas, 'k');
    await press(page, canvas, 'k');
    await expect(canvas).toHaveAttribute('data-engine', 'running');
    await page.keyboard.down('ArrowDown');
    await waitForSimulation(canvas, 0.5);
    await press(page, canvas, 'e');
    await press(page, canvas, 'e');
    await press(page, canvas, 'e');
    await press(page, canvas, 'Space');
    await page.keyboard.up('ArrowDown');

    await expect(canvas).toHaveAttribute('data-gear', 'D1');
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-odometer-m')), { timeout: 5000 })
      .toBeGreaterThan(0.5);
    await expect(readout(page, 'Freno de mano')).toHaveText('Sin poner');
  });

  test('manual: starts with the clutch down, engages first and pulls away with throttle as the clutch comes up', async ({
    page,
  }) => {
    const canvas = await openYard(page);
    await canvas.focus();

    await page.keyboard.down('Shift');
    await waitForSimulation(canvas, 0.4);
    await press(page, canvas, 'k');
    await press(page, canvas, 'k');
    await press(page, canvas, 'e');
    await press(page, canvas, 'Space');
    await page.keyboard.down('ArrowUp');
    await waitForSimulation(canvas, 0.2);
    await page.keyboard.up('Shift');

    await expect
      .poll(async () => Number(await canvas.getAttribute('data-odometer-m')), { timeout: 6000 })
      .toBeGreaterThan(1);
    await expect(canvas).toHaveAttribute('data-engine', 'running');
    await page.keyboard.up('ArrowUp');

    // Finishing (protocolo PDF 13, 25): stop with the clutch down, handbrake, neutral, engine off, key out.
    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowDown');
    await expect.poll(async () => Number(await canvas.getAttribute('data-speed-kmh')), { timeout: 5000 }).toBe(0);
    await waitForSimulation(canvas, 0.3);
    await press(page, canvas, 'Space');
    await press(page, canvas, 'q');
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('Shift');
    await press(page, canvas, 'k');
    await press(page, canvas, 'k');
    await expect(canvas).toHaveAttribute('data-gear', 'N');
    await expect(readout(page, 'Llave')).toHaveText('Afuera');
    await expect(readout(page, 'Freno de mano')).toHaveText('Puesto');
    await expect(readout(page, 'Motor')).toHaveText('Apagado');

    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect.poll(async () => Number(await canvas.getAttribute('data-odometer-m'))).toBe(0);
  });

  test('keeps the page keyboard when the view does not have focus', async ({ page }) => {
    const canvas = await openYard(page);

    await page.keyboard.press('k');

    await expect(readout(page, 'Llave')).toHaveText('Afuera');
    await expect.poll(async () => canvas.getAttribute('data-engine')).toBe('off');
  });
});
