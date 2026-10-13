import { expect, test, withoutServiceWorkers } from './fixtures.ts';
import type { Page } from '@playwright/test';

const CONCEPT = 'Ceder el paso a peatones al girar con luz verde';

async function answerCorrectly(page: Page) {
  await page.goto('./#/actividad/act.turn-with-pedestrian?semilla=0');
  await page.getByRole('button', { name: /30 m antes enciendo la luz de giro/ }).click();
  await page.getByRole('button', { name: 'Freno y le cedo el paso, aunque tenga verde' }).click();
  await expect(page.getByRole('heading', { name: '¡Correcto!' })).toBeVisible();
}

const campaignB = (page: Page) => page.getByRole('region', { name: 'Campaña licencia B' });

test.describe('progress and logbook', () => {
  test('survives a reload and is restored from a backup in a fresh browser', async ({ page, browser }, testInfo) => {
    await answerCorrectly(page);
    await page.goto('./#/bitacora');
    await expect(campaignB(page).getByRole('link', { name: CONCEPT })).toBeVisible();

    await page.reload();
    await expect(campaignB(page).getByRole('link', { name: CONCEPT })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar respaldo' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^al-volante-progreso-\d{4}-\d{2}-\d{2}\.json$/);
    const backupPath = testInfo.outputPath('respaldo.json');
    await download.saveAs(backupPath);

    // A new context has its own, empty IndexedDB: a different browser for the purposes of the backup.
    const fresh = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    await withoutServiceWorkers(fresh);
    const other = await fresh.newPage();
    await other.goto('./#/bitacora');
    await expect(campaignB(other).getByText('Todavía no practicaste conceptos de esta parte.')).toBeVisible();
    await other.getByLabel('Importar un respaldo').setInputFiles(backupPath);
    await other.getByRole('button', { name: 'Reemplazar mi progreso' }).click();
    await expect(other.getByText('Listo: restauramos tu progreso desde el respaldo.')).toBeVisible();
    await other.reload();
    await expect(campaignB(other).getByRole('link', { name: CONCEPT })).toBeVisible();
    await fresh.close();
  });

  test('shows an answer given in another tab without reloading', async ({ context }) => {
    const logbook = await context.newPage();
    await logbook.goto('./#/bitacora');
    await expect(campaignB(logbook).getByText('Todavía no practicaste conceptos de esta parte.')).toBeVisible();

    const activityTab = await context.newPage();
    await answerCorrectly(activityTab);

    await expect(campaignB(logbook).getByRole('link', { name: CONCEPT })).toBeVisible();
  });

  test('rejects a corrupt backup without touching the stored progress', async ({ page }) => {
    await answerCorrectly(page);
    await page.goto('./#/bitacora');
    await expect(campaignB(page).getByRole('link', { name: CONCEPT })).toBeVisible();

    await page.getByLabel('Importar un respaldo').setInputFiles({
      name: 'roto.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"format":"al-volante-progress","formatVersion":1,"attempts":"nope"}'),
    });
    await expect(page.getByRole('alert')).toContainText('datos dañados');

    await page.reload();
    await expect(campaignB(page).getByRole('link', { name: CONCEPT })).toBeVisible();
  });
});
