import { expect, test } from '@playwright/test';

test.describe('activities', () => {
  test('answers a sign activity with the keyboard and follows its source to the library', async ({ page }) => {
    await page.goto('./#/actividades');
    await page.getByRole('link', { name: 'Señales reglamentarias' }).click();
    await expect(page).toHaveURL(/#\/actividad\/act\.regulatory-signs\?semilla=\d+$/);
    await expect(page.getByRole('img', { name: /^Señal a identificar: / })).toBeVisible();

    // Keyboard only: focus the first option, pick it with Space, then submit.
    await page.getByRole('radio').first().focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Responder' }).press('Enter');

    const verdict = page.getByRole('heading', { name: /^(¡Correcto!|No es correcto)$/ });
    await expect(verdict).toBeVisible();
    const source = page.getByRole('link', { name: 'Manual, PDF 186' });
    await expect(source).toBeVisible();
    await source.click();
    await expect(page.getByRole('heading', { level: 1, name: /^Página 186 · Manual teórico/ })).toBeVisible();
  });

  test('plays a decision scene to the end and offers another variant', async ({ page }) => {
    await page.goto('./#/actividad/act.turn-with-pedestrian?semilla=0');

    await page.getByRole('button', { name: /30 m antes enciendo la luz de giro/ }).click();
    await page.getByRole('button', { name: 'Freno y le cedo el paso, aunque tenga verde' }).click();

    await expect(page.getByRole('heading', { name: '¡Correcto!' })).toBeVisible();
    await page.getByRole('button', { name: 'Otra variante' }).click();
    await expect(page).toHaveURL(/semilla=1$/);
  });
});
