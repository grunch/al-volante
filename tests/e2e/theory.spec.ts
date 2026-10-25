import { expect, test } from './fixtures.ts';

test.describe('theory mock exam', () => {
  test('opens the exam room from home, grades a paper handed in early and keeps it in the logbook', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByRole('region', { name: 'Espacios' }).getByRole('link', { name: 'Sala de examen' }).click();

    await expect(page).toHaveURL(/#\/examen\/teorico\?semilla=\d+$/);
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

  test('reaches the theoretical exam from the Examen link: 40 minutes at most and 6 mistakes allowed', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Examen' }).click();

    await expect(page).toHaveURL(/#\/examen$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Examen' })).toBeFocused();
    await expect(page.getByRole('region', { name: 'Examen práctico' })).toBeVisible();
    const theory = page.getByRole('region', { name: 'Examen teórico' });
    await expect(theory).toContainText('40 preguntas de opción múltiple de las cuatro fuentes del material oficial');
    await theory.getByRole('link', { name: 'Ir al examen teórico' }).click();

    await expect(page).toHaveURL(/#\/examen\/teorico\?semilla=\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Examen teórico' })).toBeVisible();
    await expect(page.getByText(/con más de 6 errores .* no aprobás\. Tenés 40 minutos como máximo\.$/)).toBeVisible();
    // A single time: nothing to choose before starting.
    await expect(page.getByRole('radio')).toHaveCount(0);
    await page.getByRole('button', { name: 'Empezar el simulacro' }).click();

    await expect(page.getByRole('timer')).toContainText(/(40:00|39:5\d)/);
    await page.getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByText('Errores: 40. Con más de 6 errores, el examen no se aprueba.')).toBeVisible();
  });
});
