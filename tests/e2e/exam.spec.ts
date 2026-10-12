import { expect, test } from '@playwright/test';

test.describe('practical exam, stage I and the box', () => {
  test('guides from the familiarisation to the recognition, and a stop request disapproves', async ({ page }) => {
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
});
