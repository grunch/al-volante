import { expect, test } from '@playwright/test';

test.describe('practical exam on the circuit', () => {
  test('guides from the familiarisation to the recognition on the city, and a stop request disapproves', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./#/examen');
    const view = page.getByTestId('driving-canvas');
    await expect(view).toHaveAttribute('data-state', 'ready');
    await expect(view).toHaveAttribute('data-engine', 'off');
    const says = page.getByTestId('examiner-says');
    await expect(says).toHaveAttribute('data-phase', 'familiarisation');
    await expect(page.getByTestId('exam-light')).toHaveText(/Verde|Amarillo|Rojo/);

    await page.getByRole('button', { name: 'Listo, sigamos' }).click();
    await expect(says).toHaveAttribute('data-phase', 'recognition');
    await expect(says).not.toHaveText('');

    await page.getByRole('button', { name: 'Pedir que se interrumpa el examen' }).click();
    await expect(page.getByTestId('exam-result')).toContainText('Desaprobado');
    await expect(says).toHaveAttribute('data-phase', 'finished');
    expect(errors).toEqual([]);
  });

  test('shows the first instruction of the circuit, the leg and the limits of the road in the HUD', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./#/examen');
    const view = page.getByTestId('driving-canvas');
    await expect(view).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('exam-leg')).toHaveText('Tramo 1 · Quesada');
    await expect(page.getByTestId('exam-instruction')).toHaveText(
      'En la próxima esquina, doblá a la derecha, por Av. Cabildo.',
    );
    await expect(page.getByTestId('exam-limits')).toContainText('30 km/h de examen');
    await expect(page.getByTestId('exam-limits')).toContainText('40 km/h');
    await expect
      .poll(async () => Number(await view.getAttribute('data-actors')), { timeout: 20000 })
      .toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});
