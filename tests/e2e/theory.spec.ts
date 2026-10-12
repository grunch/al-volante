import { expect, test } from '@playwright/test';

test.describe('theory mock exam', () => {
  test('opens the exam room from home, grades a paper handed in early and keeps it in the logbook', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByRole('region', { name: 'Espacios' }).getByRole('link', { name: 'Sala de examen' }).click();

    await expect(page).toHaveURL(/#\/teorico\?semilla=\d+$/);
    await expect(page.getByText(/^40 preguntas de opción múltiple con 3 opciones/)).toBeVisible();
    await page.getByRole('button', { name: 'Empezar el simulacro' }).click();

    await expect(page.getByRole('radio')).toHaveCount(120);
    await page.getByRole('radio').first().check();
    await expect(page.getByText(/Respondiste 1 de 40/)).toBeVisible();
    await page.getByRole('button', { name: 'Entregar' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'No aprobado' })).toBeVisible();
    await expect(page.getByText('Sin responder: 39 (cuentan como incorrectas).')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Resultado por tema' })).toBeVisible();

    await page.goto('./#/bitacora');
    await expect(page.getByTestId('theory-log').getByRole('listitem')).toHaveCount(1);
    await expect(page.getByTestId('theory-log')).toContainText(/de 40 · No aprobado/);
  });
});
