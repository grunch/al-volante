import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const readout = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator('xpath=following-sibling::dd');

async function openYard(page: Page): Promise<Locator> {
  await page.goto('./#/pista');
  const canvas = page.getByRole('application', { name: /Vista 3D de la pista de prueba/ });
  await expect(canvas).toHaveAttribute('data-state', 'ready');
  return canvas;
}

async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await page.waitForTimeout(80);
}

test.describe('practice yard', () => {
  test('automatic: starts in P, goes to D with the brake held and creeps off once the brake is released', async ({
    page,
  }) => {
    await page.goto('./#/pista');
    await page.getByRole('radio', { name: 'Automática' }).check();
    const canvas = page.getByRole('application', { name: /Vista 3D de la pista de prueba/ });
    await expect(canvas).toHaveAttribute('data-state', 'ready');
    await canvas.focus();

    await press(page, 'k');
    await press(page, 'k');
    await expect(canvas).toHaveAttribute('data-engine', 'running');
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(500);
    await press(page, 'e');
    await press(page, 'e');
    await press(page, 'e');
    await press(page, 'Space');
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
    await page.waitForTimeout(400);
    await press(page, 'k');
    await press(page, 'k');
    await press(page, 'e');
    await press(page, 'Space');
    await page.keyboard.down('ArrowUp');
    await page.keyboard.up('Shift');

    await expect
      .poll(async () => Number(await canvas.getAttribute('data-odometer-m')), { timeout: 6000 })
      .toBeGreaterThan(1);
    await expect(canvas).toHaveAttribute('data-engine', 'running');
    await page.keyboard.up('ArrowUp');
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect.poll(async () => Number(await canvas.getAttribute('data-odometer-m'))).toBe(0);
    await expect(readout(page, 'Llave')).toHaveText('Afuera');
  });

  test('keeps the page keyboard when the view does not have focus', async ({ page }) => {
    const canvas = await openYard(page);

    await page.keyboard.press('k');

    await expect(readout(page, 'Llave')).toHaveText('Afuera');
    await expect.poll(async () => canvas.getAttribute('data-engine')).toBe('off');
  });
});
