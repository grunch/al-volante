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
    await expect(page.getByTestId('exam-light')).toHaveText('sin semáforo cerca');

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

  test('shows the stage III readings in the HUD and the door control in the cabin (F04-T04)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./#/examen');
    const view = page.getByTestId('driving-canvas');
    await expect(view).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('exam-parking')).toHaveText('0 maniobras · 0 intentos');
    await expect(page.getByTestId('exam-kerb')).toHaveText('pendiente');
    await expect(page.getByRole('button', { name: 'Abrir la puerta y bajar' })).toBeVisible();
    await expect(page.getByText(/estacionamiento paralelo en el cajón/)).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('exam modes (F04-T05)', () => {
  test('offers the four modes and hides every aid in the exam mode, keeping what the examiner says', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./#/examen');
    const view = page.getByTestId('driving-canvas');
    await expect(view).toHaveAttribute('data-state', 'ready');
    const modes = page.getByRole('group', { name: 'Modo' });
    await expect(modes.getByRole('radio')).toHaveCount(4);
    await expect(modes.getByRole('radio', { name: 'Recorrer' })).toBeChecked();
    await expect(page.getByTestId('exam-points')).toHaveText('0');

    await modes.getByRole('radio', { name: 'Rendir' }).click();
    await expect(page).toHaveURL(/modo=rendir/);
    await expect(page.getByTestId('exam-hud')).toHaveAttribute('data-aids', '');
    await expect(page.getByTestId('exam-points')).toHaveCount(0);
    await expect(page.getByTestId('exam-notice')).toHaveCount(0);
    await expect(page.getByTestId('exam-limits')).toHaveCount(0);
    await expect(page.getByTestId('exam-light')).toHaveCount(0);
    await expect(page.getByTestId('exam-parking')).toHaveCount(0);
    await expect(page.getByTestId('exam-no-aids')).toContainText('se informan al final');
    await expect(page.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'familiarisation');
    await expect(page.getByTestId('exam-instruction')).toHaveText(
      'En la próxima esquina, doblá a la derecha, por Av. Cabildo.',
    );

    await page.getByRole('button', { name: 'Pedir que se interrumpa el examen' }).click();
    const card = page.getByTestId('exam-card');
    await expect(card.getByTestId('exam-result')).toContainText('Desaprobado');
    await expect(card.getByTestId('exam-card-stage-I')).toContainText('incompleta');
    await expect(card.getByTestId('exam-card-total')).toContainText('Total: 0 puntos');
    await expect(page.getByTestId('exam-saved')).toHaveAttribute('data-save', 'saved');
    expect(errors).toEqual([]);
  });

  test('practises stage III from leg 8 and explains the rules in the learning mode', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./#/examen?modo=practicar&etapa=3');
    const view = page.getByTestId('driving-canvas');
    await expect(view).toHaveAttribute('data-state', 'ready');
    await expect(view).toHaveAttribute('data-engine', 'running');
    await expect(page.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'circulation');
    await expect(page.getByTestId('exam-leg')).toHaveText('Tramo 8 · Vuelta de Obligado');

    await page.goto('./#/examen?modo=aprender');
    await expect(page.getByTestId('examiner-says')).toHaveAttribute('data-mode', 'learn');
    await expect(page.getByTestId('exam-hints')).toContainText('Qué se evalúa ahora');
    expect(errors).toEqual([]);
  });
});

test('can leave the exam page through the navigation while the drive is running', async ({ page }) => {
  // The readouts update every frame; as urgent updates they used to starve the navigation's transition.
  await page.goto('./#/examen');
  await expect(page.getByTestId('driving-canvas')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('link', { name: 'Mi bitácora' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mi bitácora');
});
