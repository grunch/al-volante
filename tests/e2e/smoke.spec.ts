import { expect, test } from '@playwright/test';

test.describe('home page', () => {
  test('loads, renders the 3D garage and has no console errors', async ({ page }) => {
    // Arrange
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    // Act
    await page.goto('./');

    // Assert
    await expect(page.getByRole('heading', { level: 1, name: 'Al volante: Comuna 13' })).toBeVisible();
    const scene = page.getByTestId('garage-scene');
    await expect(scene).toHaveAttribute('data-state', 'ready', { timeout: 15_000 });
    const box = await scene.locator('canvas').boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(100);
    expect(box?.height ?? 0).toBeGreaterThan(50);
    expect(errors).toEqual([]);
  });

  test('offers a skip link as the first keyboard stop', async ({ page }) => {
    await page.goto('./');

    await page.keyboard.press('Tab');

    const skip = page.getByRole('link', { name: 'Saltar al contenido' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('declares Rioplatense Spanish and a descriptive title', async ({ page }) => {
    await page.goto('./');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
    await expect(page).toHaveTitle('Al volante: Comuna 13');
  });
});
