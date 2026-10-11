import { expect, test } from '@playwright/test';

test.describe('practice yard', () => {
  test('drives forward with the keyboard, brakes to a stop and shows it in the readouts', async ({ page }) => {
    await page.goto('./#/pista');
    const canvas = page.getByRole('application', { name: /Vista 3D de la pista de prueba/ });
    await expect(canvas).toHaveAttribute('data-state', 'ready');

    await canvas.focus();
    await page.keyboard.down('ArrowUp');
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-odometer-m')), { timeout: 5000 })
      .toBeGreaterThan(2);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.down('ArrowDown');
    await expect.poll(async () => Number(await canvas.getAttribute('data-speed-kmh')), { timeout: 5000 }).toBe(0);
    await page.keyboard.up('ArrowDown');

    await expect(page.getByText('Recorrido').locator('xpath=following-sibling::dd')).not.toHaveText('0,0 m');
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect.poll(async () => Number(await canvas.getAttribute('data-odometer-m'))).toBe(0);
  });

  test('keeps the page keyboard when the view does not have focus', async ({ page }) => {
    await page.goto('./#/pista');
    const canvas = page.getByRole('application', { name: /Vista 3D de la pista de prueba/ });
    await expect(canvas).toHaveAttribute('data-state', 'ready');

    await page.keyboard.press('ArrowUp');

    await expect.poll(async () => Number(await canvas.getAttribute('data-odometer-m'))).toBe(0);
  });
});
