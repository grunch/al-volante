import { expect as baseExpect, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 30_000 });
test.use({ autoStartMobile: false });
test.describe.configure({ timeout: 180_000 });

/** A synthetic sensor keeps wall-clock timestamps; production has no test input API. */
async function sensor(page: Page, denied = false) {
  await page.addInitScript(
    ({ denied }) => {
      Object.defineProperty(window, 'GravitySensor', { configurable: true, value: undefined });
      Object.defineProperty(DeviceMotionEvent, 'requestPermission', {
        configurable: true,
        value: async () => (denied ? 'denied' : 'granted'),
      });
      const state = { angle: 0, projection: 9.80665, enabled: true };
      Object.assign(window, { mobileTestSensor: state });
      let sampledAtMs = performance.now();
      const sample = (now: number) => {
        const rotation = ((state.angle + (screen.orientation?.angle ?? 0)) * Math.PI) / 180;
        // Deliver the sensor's 60 Hz history before the driving frame, even when software WebGL blocks JS timers.
        while (sampledAtMs + 1000 / 60 <= now) {
          sampledAtMs += 1000 / 60;
          if (!state.enabled) continue;
          const event = new DeviceMotionEvent('devicemotion', {
            accelerationIncludingGravity: {
              x: Math.sin(rotation) * state.projection,
              y: Math.cos(rotation) * state.projection,
              z: Math.sqrt(Math.max(0, 9.80665 ** 2 - state.projection ** 2)),
            },
            rotationRate: { alpha: 0, beta: 0, gamma: 0 },
            interval: 16,
          });
          Object.defineProperty(event, 'timeStamp', { value: sampledAtMs });
          window.dispatchEvent(event);
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    { denied },
  );
}
async function setSensor(page: Page, values: { angle?: number; projection?: number; enabled?: boolean }) {
  await page.evaluate(
    (values) => Object.assign((window as unknown as { mobileTestSensor: object }).mobileTestSensor, values),
    values,
  );
}
async function begin(page: Page, buttons = false) {
  await page.goto('./#/pista');
  const canvas = page.getByTestId('driving-canvas');
  await expect(canvas).toHaveAttribute('data-state', 'ready');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: buttons ? 'Manejar con botones' : 'Empezar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(canvas).toBeFocused();
  return canvas;
}
async function point(locator: Locator, vertical = 0.5) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Mobile control is not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height * vertical };
}
async function key(page: Page, canvas: Locator) {
  const button = page.getByRole('button', { name: 'Accionar llave', exact: true });
  await button.click();
  await expect(canvas).toHaveAttribute('data-key', 'on');
  await button.click();
  await expect(canvas).toHaveAttribute('data-engine', 'running');
}

test('mobile: calibrates, steers, recenters, expires, recovers and shows orientation warnings', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Mobile sensors require a coarse primary pointer');
  await page.setViewportSize({ width: 915, height: 412 });
  await sensor(page);
  const canvas = await begin(page);
  await expect(canvas).toHaveAttribute('data-steering-source', 'tilt');
  await expect(page.getByText('Sostené el teléfono quieto, como un volante')).toHaveCount(0);
  await setSensor(page, { angle: 40 });
  await expect.poll(async () => Number(await canvas.getAttribute('data-steer'))).toBeGreaterThan(0.25);
  await key(page, canvas);
  await page.getByRole('button', { name: 'Elegir 1', exact: true }).tap();
  await expect(canvas).toHaveAttribute('data-gear', '1');
  await page.getByRole('button', { name: 'Accionar freno de mano', exact: true }).click();
  const heading = Number(await canvas.getAttribute('data-heading-rad'));
  const accelerator = await point(page.getByTestId('mobile-pedals'), 0.05);
  await page.mouse.move(accelerator.x, accelerator.y);
  await page.mouse.down();
  try {
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-heading-rad')) - heading)
      .toBeGreaterThan(0.02);
  } finally {
    await page.mouse.up();
  }
  const brake = await point(page.getByTestId('mobile-pedals'), 0.98);
  await page.mouse.move(brake.x, brake.y);
  await page.mouse.down();
  try {
    await expect.poll(async () => Number(await canvas.getAttribute('data-speed-kmh'))).toBe(0);
  } finally {
    await page.mouse.up();
  }
  await page.getByRole('button', { name: 'Accionar freno de mano', exact: true }).click();
  await page.getByRole('button', { name: 'Centrar volante' }).click();
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-steer')))).toBeLessThan(0.01);
  await setSensor(page, { projection: 1 });
  await expect(page.getByText('Levantá un poco el teléfono')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-steering-source', 'buttons');
  await setSensor(page, { projection: 9.80665, enabled: false });
  await expect(page.getByText('No se pudo leer la inclinación; usá los botones')).toBeVisible();
  await setSensor(page, { enabled: true });
  await expect(canvas).toHaveAttribute('data-steering-source', 'tilt');
  await page.evaluate(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  });
  await page.setViewportSize({ width: 412, height: 915 });
  await expect(page.getByText('Girá el teléfono a horizontal para manejar inclinándolo')).toBeVisible();
  await page.getByText('Controles del celular', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Volante por inclinación' }).uncheck();
  await expect(canvas).toHaveAttribute('data-steering-source', 'buttons');
});

test('mobile manual: selects gears without clutch and turns while accelerating with two thumbs', async ({
  page,
  context,
  isMobile,
}, testInfo) => {
  test.skip(!isMobile, 'Requires multitouch');
  await page.setViewportSize({ width: 915, height: 412 });
  const canvas = await begin(page, true);
  const pedals = page.getByRole('group', { name: 'Pedalera y caja' });
  for (const name of ['Volante a la izquierda', 'Volante a la derecha', 'Frenar', 'Acelerar'])
    await expect(pedals.getByRole('button', { name, exact: true })).toHaveCount(0);
  await expect(pedals.getByRole('button', { name: 'Embrague', exact: true })).toBeVisible();
  await key(page, canvas);
  await page.getByRole('button', { name: 'Elegir 1', exact: true }).tap();
  await expect(canvas).toHaveAttribute('data-gear', '1');
  await page.getByRole('button', { name: 'Accionar freno de mano', exact: true }).click();
  const pedal = { ...(await point(page.getByTestId('mobile-pedals'), 0.05)), id: 1 };
  const right = {
    ...(await point(page.getByRole('group', { name: 'Volante con botones' }).getByRole('button').first())),
    id: 2,
  };
  const initialHeading = Number(await canvas.getAttribute('data-heading-rad'));
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pedal, right] });
  try {
    await expect.poll(async () => Number(await canvas.getAttribute('data-throttle'))).toBeGreaterThan(0.8);
    await expect.poll(async () => Number(await canvas.getAttribute('data-speed-kmh'))).toBeGreaterThan(3);
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-heading-rad')) - initialHeading)
      .toBeGreaterThan(0.02);
  } finally {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await page.getByRole('button', { name: 'Elegir 2', exact: true }).tap();
  await expect(canvas).toHaveAttribute('data-gear', '2');
  await page.getByRole('button', { name: 'Elegir R', exact: true }).tap();
  await expect(page.getByTestId('driving-feedback')).toContainText('movimiento');
  await expect(canvas).toHaveAttribute('data-engine', 'running');
  await page.screenshot({ path: testInfo.outputPath('mobile-manual.png') });
  const brake = { ...(await point(page.getByTestId('mobile-pedals'), 0.98)), id: 1 };
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [brake] });
  try {
    await expect.poll(async () => Number(await canvas.getAttribute('data-speed-kmh'))).toBe(0);
  } finally {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
  }
});

test('mobile automatic: denied permission keeps buttons and brake plus D work with separate fingers', async ({
  page,
  context,
  isMobile,
}, testInfo) => {
  test.skip(!isMobile, 'Requires multitouch');
  await page.setViewportSize({ width: 915, height: 412 });
  await sensor(page, true);
  await begin(page);
  await page.evaluate(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  });
  await page.getByRole('radio', { name: 'Automática', exact: true }).check();
  const canvas = page.getByTestId('driving-canvas');
  await expect(canvas).toHaveAttribute('data-state', 'ready');
  // Changing gearbox remounts the cabin and starts a fresh mobile session.
  const intro = page.getByRole('button', { name: 'Empezar', exact: true });
  if (await intro.count()) await intro.click();
  await expect(page.getByText('No se pudo leer la inclinación; usá los botones')).toBeVisible();
  await key(page, canvas);
  await page.getByRole('button', { name: 'Elegir D', exact: true }).tap();
  await expect(page.getByTestId('driving-feedback')).toContainText('pisá el freno');
  const brake = { ...(await point(page.getByTestId('mobile-pedals'), 0.98)), id: 1 };
  const gear = { ...(await point(page.getByRole('button', { name: 'Elegir D', exact: true }))), id: 2 };
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [brake, gear] });
  try {
    // CDP ends the listed pointers; release only the gear finger and keep braking.
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [gear] });
    await expect(canvas).toHaveAttribute('data-gear', 'D1');
  } finally {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
  }
  await expect(canvas).toHaveAttribute('data-gear', 'D1');
  await expect(page.getByRole('button', { name: 'Elegir D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('mobile-automatic.png') });
});

test('desktop: never starts sensors, shows mobile controls or requests a wake lock', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop regression');
  await page.addInitScript(() => {
    const forbidden = () => {
      throw new Error('Desktop requested mobile hardware');
    };
    Object.defineProperty(window, 'GravitySensor', { value: forbidden, configurable: true });
    Object.defineProperty(navigator, 'wakeLock', { value: { request: forbidden }, configurable: true });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./#/pista');
  await expect(page.getByTestId('driving-canvas')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('mobile-overlay')).toHaveCount(0);
  await page.setViewportSize({ width: 667, height: 375 });
  const pedals = page.getByRole('group', { name: 'Pedalera y caja' });
  for (const name of ['Volante a la izquierda', 'Volante a la derecha', 'Frenar', 'Acelerar'])
    await expect(pedals.getByRole('button', { name, exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile: thumb controls fit landscape sizes and portrait retains the orientation notice', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Mobile layout');
  await page.setViewportSize({ width: 667, height: 375 });
  await begin(page);
  await page.evaluate(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  });
  for (const size of [
    { width: 667, height: 375 },
    { width: 915, height: 412 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(size);
    const strip = await page.getByTestId('mobile-pedals').boundingBox();
    expect(strip?.width).toBeGreaterThanOrEqual(64);
    const viewport = await page.locator('.cockpit-viewport').boundingBox();
    if (!viewport) throw new Error('Driving viewport is not visible');
    for (const button of await page.getByRole('group', { name: 'Palanca de cambios' }).getByRole('button').all()) {
      const box = await button.boundingBox();
      if (!box) throw new Error('Gear button is not visible');
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.x + viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.y + viewport.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Centrar volante' })).toBeVisible();
  }
  await page.evaluate(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.getByText('Girá el teléfono a horizontal para manejar inclinándolo')).toBeVisible();
  await expect(page.getByTestId('mobile-pedals')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mobile: returns focus to driving when fullscreen is unavailable', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile introduction');
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen denied'));
  });
  const canvas = await begin(page, true);
  await expect(page.getByText('Este navegador no pudo abrir la pantalla completa.', { exact: false })).toBeVisible();
  await expect(canvas).toBeFocused();
  await page.keyboard.press('KeyK');
  await expect(canvas).toHaveAttribute('data-key', 'on');
});

test('mobile: operates the pedal labels with keyboard focus and semantic clicks', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile pedal accessibility');
  await page.setViewportSize({ width: 915, height: 412 });
  const canvas = await begin(page, true);
  await key(page, canvas);
  const throttle = page.getByRole('button', { name: 'Acelerar ↑', exact: true });
  const brake = page.getByRole('button', { name: 'Frenar ↓', exact: true });
  await throttle.focus();
  await page.keyboard.press('Tab');
  await expect(brake).toBeFocused();
  await page.keyboard.press('Space');
  await expect(brake).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-brake', '1.0000');
  const first = page.getByRole('button', { name: 'Elegir 1', exact: true });
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(canvas).toHaveAttribute('data-gear', '1');
  await expect(canvas).toHaveAttribute('data-brake', '1.0000');
  await page.getByRole('button', { name: 'Accionar freno de mano', exact: true }).click();
  await throttle.focus();
  await page.keyboard.press('Enter');
  await expect(brake).toHaveAttribute('aria-pressed', 'false');
  await expect(canvas).toHaveAttribute('data-throttle', '1.0000');
  await expect.poll(async () => Number(await canvas.getAttribute('data-speed-kmh'))).toBeGreaterThan(3);
  // Assistive technology can activate a button without a pointer coordinate or a physical key sequence.
  await brake.dispatchEvent('click', { detail: 0 });
  await expect(throttle).toHaveAttribute('aria-pressed', 'false');
  await expect(canvas).toHaveAttribute('data-throttle', '0.0000');
  await expect(canvas).toHaveAttribute('data-brake', '1.0000');
  await expect.poll(async () => Number(await canvas.getAttribute('data-speed-kmh'))).toBe(0);
  await brake.focus();
  await page.keyboard.press('Space');
  await expect(brake).toHaveAttribute('aria-pressed', 'false');
  await expect(canvas).toHaveAttribute('data-brake', '0.0000');
});
