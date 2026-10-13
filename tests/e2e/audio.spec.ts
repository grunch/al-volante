import { expect, test } from './fixtures.ts';

test('unlocks real audio on a gesture, adjusts volume without resetting the car, suspends and closes', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const audit = { created: 0, closed: 0, state: 'none', master: null as GainNode | null };
    Object.assign(window, { audioAudit: audit });
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        audit.created++;
        this.addEventListener('statechange', () => {
          audit.state = this.state;
        });
      }
      override createGain() {
        const gain = super.createGain();
        audit.master ??= gain;
        return gain;
      }
      override async close() {
        audit.closed++;
        await super.close();
      }
    };
  });
  const audit = () =>
    page.evaluate(() => {
      const value = (
        window as unknown as { audioAudit: { created: number; closed: number; state: string; master: GainNode | null } }
      ).audioAudit;
      return { ...value, master: value.master?.gain.value ?? 0 };
    });
  await page.goto('/#/pista');
  const view = page.getByTestId('driving-canvas');
  await expect(view).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  expect((await audit()).created).toBe(0);
  await view.focus();
  await page.keyboard.press('KeyK');
  await page.keyboard.press('KeyK');
  await expect(view).toHaveAttribute('data-engine', 'running');
  await expect.poll(async () => (await audit()).state).toBe('running');
  const time = Number(await view.getAttribute('data-time-s'));
  await page.getByRole('slider', { name: 'Volumen', exact: true }).fill('25');
  await expect.poll(async () => (await audit()).master).toBeCloseTo(0.25, 2);
  await expect(view).toHaveAttribute('data-engine', 'running');
  expect(Number(await view.getAttribute('data-time-s'))).toBeGreaterThanOrEqual(time);
  await page.getByRole('button', { name: 'Silenciar', exact: true }).click();
  await expect.poll(async () => (await audit()).master).toBeLessThan(0.001);
  await expect(page.getByText('Audio silenciado.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Activar sonido', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(async () => (await audit()).state).toBe('suspended');
  await view.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await audit()).state).toBe('running');
  expect((await audit()).created).toBe(1);
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect.poll(async () => (await audit()).closed).toBe(1);
  expect(errors).toEqual([]);
});
