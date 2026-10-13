import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// PWA01-T01: every page fits every screen, from a 320 px phone to a 4K monitor, upright and sideways.
// The viewports set their own touch emulation, so the suite runs once, in the desktop project.
const VIEWPORTS = [
  { name: 'phone 320×568', width: 320, height: 568, touch: true },
  { name: 'phone in landscape 568×320', width: 568, height: 320, touch: true },
  { name: 'tablet 768×1024', width: 768, height: 1024, touch: true },
  { name: 'desktop 1920×1080', width: 1920, height: 1080, touch: false },
  { name: '4K 3840×2160', width: 3840, height: 2160, touch: false },
] as const;

const TEXT_PAGES = [
  '/',
  '/garaje',
  '/mapa',
  '/mapa/manual/ch3',
  '/actividades',
  '/actividad/act.turn-with-pedestrian?semilla=0',
  '/actividad/act.car-mirror-setup?semilla=0',
  '/senales',
  '/biblioteca',
  '/biblioteca/manual/72',
  '/teorico?semilla=1',
  '/bitacora',
  '/no-existe',
] as const;

// Containers whose box must stay inside the screen width; missing ones are skipped.
const KEY_CONTAINERS = [
  '.app-header',
  '#main',
  '.app-footer',
  'h1',
  '.card-grid',
  '.unit-list',
  '.sign-grid',
  '.extracted-text',
  '.question',
  '.hud',
  '.cockpit-shell',
  '.cockpit-controls',
  '.city-layout',
  'canvas',
] as const;

const SOFTWARE_WEBGL_TIMEOUT_MS = 60_000;

/** Horizontal page overflow and key containers outside the viewport, as readable messages. */
async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate((selectors) => {
    const problems: string[] = [];
    const root = document.scrollingElement ?? document.documentElement;
    if (root.scrollWidth > root.clientWidth)
      problems.push(`page scrolls sideways: ${root.scrollWidth} > ${root.clientWidth}`);
    const width = root.clientWidth;
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const box = element.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        if (box.left < -1 || box.right > width + 1) {
          problems.push(`${selector} spans ${Math.round(box.left)}–${Math.round(box.right)} of ${width} px`);
        }
      }
    }
    return problems;
  }, KEY_CONTAINERS);
}

async function boxOf(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label} has no layout box`);
  return box;
}

async function expectToFit(page: Page, label: string) {
  expect(await layoutProblems(page), label).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.touch,
      isMobile: viewport.touch,
      deviceScaleFactor: viewport.touch ? 2 : 1,
    });

    test.beforeEach(({ browserName }, testInfo) => {
      test.skip(
        browserName !== 'chromium' || testInfo.project.name !== 'chromium-desktop',
        'The viewports emulate their own devices: one project is enough.',
      );
    });

    test('text pages fit the screen, with 44 px targets on touch screens', async ({ page }) => {
      for (const path of TEXT_PAGES) {
        await page.goto(`./#${path}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectToFit(page, path);
      }
      // The running mock exam: forty questions of three options each.
      await page.goto('./#/teorico?semilla=1');
      await page.getByRole('button', { name: 'Empezar el simulacro' }).click();
      await expect(page.getByRole('radio')).toHaveCount(120);
      await expectToFit(page, '/teorico running');
      if (viewport.touch) {
        const short = await page.evaluate(
          () =>
            [...document.querySelectorAll('.app-nav__link, .button, .option')]
              .map((element) => element.getBoundingClientRect())
              .filter((box) => box.height < 44 || box.width < 44).length,
        );
        expect(short, 'navigation links, buttons and options under 44 px').toBe(0);
      }
    });

    test('3D pages keep their layout inside the screen', async ({ page }) => {
      test.setTimeout(4 * SOFTWARE_WEBGL_TIMEOUT_MS);
      // The exam page around the cabin (examiner, guide, readings) is checked without waiting for the city.
      await page.goto('./#/examen');
      await expect(page.getByTestId('exam-hud')).toBeVisible();
      await expectToFit(page, '/examen');

      await page.goto('./#/recorrido');
      await expect(page.getByTestId('city-preview')).toHaveAttribute('data-state', 'ready', {
        timeout: SOFTWARE_WEBGL_TIMEOUT_MS,
      });
      await expectToFit(page, '/recorrido');

      // The practice yard has the same cabin, pedals and controls as the exam, and loads fastest.
      await page.goto('./#/pista');
      const view = page.getByTestId('driving-canvas');
      await expect(view).toHaveAttribute('data-state', 'ready', { timeout: SOFTWARE_WEBGL_TIMEOUT_MS });
      await expectToFit(page, '/pista');
      const viewBox = await boxOf(view, 'the 3D view');
      expect(viewBox.height, 'the 3D view keeps a usable height').toBeGreaterThanOrEqual(
        Math.min(280, viewport.height - 2),
      );
      expect(viewBox.height, 'the 3D view fits the screen height').toBeLessThanOrEqual(viewport.height);

      if (viewport.width > viewport.height && viewport.height < 512) {
        // Sideways phone: the pedals sit beside the view, not below it.
        const pedals = await boxOf(page.getByRole('group', { name: 'Pedalera y caja' }), 'the pedals');
        expect(pedals.x, 'pedals to the right of the view').toBeGreaterThanOrEqual(viewBox.x + viewBox.width - 1);
        expect(pedals.y, 'pedals start beside the top of the view').toBeLessThan(viewBox.y + viewBox.height / 2);
      }
    });
  });
}
