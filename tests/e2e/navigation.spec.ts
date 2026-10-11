import { expect, test } from '@playwright/test';

test.describe('navigation and library', () => {
  test('is fully usable with the keyboard and focuses each new page title', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi garaje' })).toBeVisible();

    // Skip link, brand, then the three navigation links.
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Mapa de aprendizaje' }).first()).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/#\/mapa$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mapa de aprendizaje' })).toBeFocused();
    await expect(page).toHaveTitle('Mapa de aprendizaje · Al volante: Comuna 13');
  });

  test('goes from the learning map to a unit and to its source page with text and official PDF', async ({ page }) => {
    await page.goto('./#/mapa');
    const campaign = page.getByRole('region', { name: 'Campaña licencia B' });
    await expect(campaign.getByRole('link')).toHaveCount(8);

    await campaign.getByRole('link', { name: 'Cap. 3 · Normas básicas de conducción' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Cap. 3 · Normas básicas de conducción' })).toBeVisible();
    await page.getByRole('link', { name: 'Ver página 72' }).first().click();

    await expect(page.getByRole('heading', { level: 1, name: /^Página 72 · Manual teórico/ })).toBeVisible();
    await expect(page.locator('.extracted-text')).toContainText('Velocidades máximas');
    await expect(page.getByRole('link', { name: 'Abrir el PDF oficial en esta página' })).toHaveAttribute(
      'href',
      /#page=72$/,
    );
  });

  test('jumps to a page with the page form and shows protocol rules on protocol pages', async ({ page }) => {
    await page.goto('./#/biblioteca/protocolo/1');
    await page.getByLabel('Ir a la página').fill('32');
    await page.getByRole('button', { name: 'Ir' }).click();

    await expect(page.getByRole('heading', { level: 1, name: /^Página 32 · Protocolo/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Reglas del examen que citan esta página' })).toContainText(
      'Cruza con el semáforo en rojo',
    );
  });

  test('has no horizontal overflow on narrow screens', async ({ page }) => {
    for (const path of ['./', './#/mapa', './#/mapa/manual/ch3', './#/biblioteca/manual/72']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
