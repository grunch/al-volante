import { expect, test } from './fixtures.ts';
import type { Locator } from '@playwright/test';

async function advance(canvas: Locator, seconds: number) {
  const start = Number(await canvas.getAttribute('data-time-s'));
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-time-s')), { timeout: 30_000 })
    .toBeGreaterThanOrEqual(start + seconds);
}

test.describe('practical driving controls', () => {
  test.describe.configure({ timeout: 180_000 });

  test('manual: combines a held keyboard clutch with a gear button and restarts after a stall', async ({ page }) => {
    await page.goto('./#/examen');
    const canvas = page.getByTestId('driving-canvas');
    await expect(canvas).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    const key = page.getByRole('button', { name: 'Accionar llave', exact: true });
    await key.click();
    await expect(canvas).toHaveAttribute('data-engine', 'running');
    await page.getByRole('button', { name: 'Activar teclado para manejar' }).click();
    await page.keyboard.down('Shift');
    await expect(canvas).toHaveAttribute('data-clutch', '1.0000');
    await page.getByRole('button', { name: 'Subir marcha', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-gear', '1');
    await advance(canvas, 2);
    await expect(canvas).toHaveAttribute('data-engine', 'running');
    await page.keyboard.up('Shift');
    await expect(canvas).toHaveAttribute('data-engine', 'off', { timeout: 20_000 });
    await expect(page.getByTestId('driving-feedback')).toContainText('Se caló el motor');
    // Focus is still on the gear button: shortcuts must keep working here.
    await page.keyboard.press('KeyK');
    await expect(page.getByTestId('driving-feedback')).toContainText('poné punto muerto (N) o pisá el embrague');
    await page.keyboard.down('Shift');
    await expect(canvas).toHaveAttribute('data-clutch', '1.0000');
    await page.keyboard.press('KeyK');
    await expect(canvas).toHaveAttribute('data-engine', 'running');
    await page.getByRole('button', { name: 'Accionar freno de mano', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-handbrake', 'false');
    await page.keyboard.down('ArrowUp');
    await advance(canvas, 0.3);
    await page.keyboard.up('Shift');
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-odometer-m')), { timeout: 20_000 })
      .toBeGreaterThan(1);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowDown');
    await expect.poll(async () => Number(await canvas.getAttribute('data-speed-kmh')), { timeout: 20_000 }).toBe(0);
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('Shift');
  });

  test('automatic: explains the parking interlock and drives using cockpit buttons plus the keyboard', async ({
    page,
  }) => {
    await page.goto('./#/examen?modo=practicar&etapa=2');
    await page.getByRole('radio', { name: 'Automática', exact: true }).check();
    const canvas = page.getByTestId('driving-canvas');
    await expect(canvas).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Accionar llave', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-engine', 'running');
    await expect(page.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'reverse');
    const up = page.getByRole('button', { name: 'Subir marcha', exact: true });
    await up.click();
    await expect(page.getByTestId('driving-feedback')).toContainText('pisá el freno');
    await page.keyboard.down('ArrowDown');
    await expect(canvas).toHaveAttribute('data-brake', '1.0000');
    await up.click();
    await expect(canvas).toHaveAttribute('data-gear', 'R');
    await page.getByRole('button', { name: 'Accionar freno de mano', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-handbrake', 'false');
    await page.keyboard.up('ArrowDown');
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-speed-kmh')), { timeout: 20_000 })
      .toBeLessThan(-0.1);
    await page.keyboard.down('ArrowDown');
    await expect.poll(async () => Number(await canvas.getAttribute('data-speed-kmh')), { timeout: 20_000 }).toBe(0);
    await page.keyboard.up('ArrowDown');
    await page.getByRole('button', { name: 'Empezar de nuevo', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-engine', 'off');
    await expect(canvas).toHaveAttribute('data-gear', 'P');
    await expect(canvas).toHaveAttribute('data-handbrake', 'true');
    await expect(page.getByTestId('driving-feedback')).toBeEmpty();
  });
});

test('touchscreen: engages first gear with a two-finger clutch and gear gesture', async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(!isMobile, 'Requires a touch-enabled browser context');
  test.setTimeout(120_000);
  await page.goto('./#/examen');
  const canvas = page.getByTestId('driving-canvas');
  await expect(canvas).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Accionar llave', exact: true }).tap();
  await expect(canvas).toHaveAttribute('data-engine', 'running');
  const clutch = page.getByRole('button', { name: 'Embrague', exact: true });
  await clutch.scrollIntoViewIfNeeded();
  const pedal = await clutch.boundingBox();
  const gear = await page.getByRole('button', { name: 'Subir marcha', exact: true }).boundingBox();
  expect(pedal).not.toBeNull();
  expect(gear).not.toBeNull();
  if (!pedal || !gear) throw new Error('Touch controls are not visible');
  const finger = { x: pedal.x + pedal.width / 2, y: pedal.y + pedal.height / 2, id: 1 };
  const second = { x: gear.x + gear.width / 2, y: gear.y + gear.height / 2, id: 2 };
  const touch = await context.newCDPSession(page);
  let touching = false;
  try {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
    touching = true;
    await expect(canvas).toHaveAttribute('data-clutch', '1.0000');
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger, second] });
    await expect(canvas).toHaveAttribute('data-clutch', '1.0000');
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    touching = false;
    await expect(canvas).toHaveAttribute('data-gear', '1');
    await expect(canvas).toHaveAttribute('data-clutch', '0.0000', { timeout: 20_000 });
    await expect(canvas).toHaveAttribute('data-engine', 'off');
    await expect(page.getByTestId('driving-feedback')).toContainText('Se caló el motor');
    // Starting a page scroll on a command must remain possible and must not engage another gear.
    const scroll = await page.evaluate(() => window.scrollY);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [second] });
    touching = true;
    for (const distance of [30, 60, 90])
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...second, y: second.y - distance }],
      });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    touching = false;
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scroll + 20);
    await expect(canvas).toHaveAttribute('data-gear', '1');
    await expect(page.getByTestId('driving-feedback')).toContainText('Se caló el motor');
  } finally {
    if (touching) await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await touch.detach();
  }
});
