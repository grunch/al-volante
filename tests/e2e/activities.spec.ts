import { expect, test } from '@playwright/test';

test.describe('activities', () => {
  test('answers a sign activity with the keyboard and follows its source to the library', async ({ page }) => {
    await page.goto('./#/actividades');
    await page.getByRole('link', { name: 'Anexo IV · Señales viales' }).click();
    await expect(page).toHaveURL(/#\/actividades\?seccion=manual-annex4$/);
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

  test('shows the figure of the official manual with the feedback, loaded from the static build', async ({ page }) => {
    await page.goto('./#/actividad/act.mobility-cycling-signs?semilla=0');
    const figure = page.getByRole('img', { name: /^Catálogo de 13 señales/ });
    await expect(figure).toHaveCount(0);

    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Responder' }).click();

    await expect(figure).toBeVisible();
    // A broken path would still render the alt text: check that the image really decoded.
    expect(await figure.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('figure.source-figure figcaption')).toHaveText('Manual, PDF 32');
  });

  test('shows the sign catalog with the crops of the manual, linked to their practice', async ({ page }) => {
    await page.goto('./#/biblioteca');
    await page.getByRole('link', { name: 'Catálogo de señales' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Catálogo de señales' })).toBeVisible();

    const preventivas = page.getByRole('region', { name: 'Preventivas', exact: true });
    const crop = preventivas.locator('img.sign-graphic--crop').first();
    await expect(crop).toBeVisible();
    expect(await crop.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await preventivas.getByRole('link', { name: 'Practicar' }).first().click();
    await expect(page).toHaveURL(/#\/actividad\/act\./);
    // The variant is random: a crop or, for the few signs drawn in vector form, an SVG; both are named images.
    await expect(page.getByRole('img', { name: /^Señal a identificar: / })).toBeVisible();
  });

  test('plays a decision scene to the end and offers another variant', async ({ page }) => {
    await page.goto('./#/actividad/act.turn-with-pedestrian?semilla=0');

    await page.getByRole('button', { name: /30 m antes enciendo la luz de giro/ }).click();
    await page.getByRole('button', { name: 'Freno y le cedo el paso, aunque tenga verde' }).click();

    await expect(page.getByRole('heading', { name: '¡Correcto!' })).toBeVisible();
    await page.getByRole('button', { name: 'Otra variante' }).press('Enter');
    await expect(page).not.toHaveURL(/semilla=0$/);
    await expect(page).toHaveURL(/semilla=\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Doblar con gente cruzando' })).toBeFocused();
  });
});
