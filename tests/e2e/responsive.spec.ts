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

/** The touch targets that `@media (pointer: coarse)` in src/ui/theme.css raises to 44 px. */
const TOUCH_TARGETS = [
  '.app-nav__link',
  '.button',
  '.option',
  '.choice label',
  '.app-main summary',
  '.app-main select',
  ".app-main input:is([type='number'], [type='text'], [type='search'])",
  '.card__title a',
  '.unit__title a',
  '.ref-link',
  '.page-nav > a',
  '.card__meta a',
  '.card__actions a:not(.button)',
  '.inline-list a',
  '.logbook-list li > a',
  '.link-list a',
  '.link-row a',
] as const;
/** Targets that must also be 44 px wide; the rest may be narrower, like a short link on its own row. */
const WIDE_TARGETS = ['.app-nav__link', '.button'] as const;
const TOUCH_TARGET_PX = 44;

/** Visible touch targets of the current page smaller than 44 px, as readable messages. */
async function smallTouchTargets(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ selectors, wide, size }) => {
      const problems: string[] = [];
      for (const selector of selectors) {
        for (const element of document.querySelectorAll(selector)) {
          const box = element.getBoundingClientRect();
          // Hidden or collapsed (for example inside a closed <details>): not a target now.
          if (box.width === 0 && box.height === 0) continue;
          const tooShort = box.height < size - 0.5;
          const tooNarrow = wide.includes(selector) && box.width < size - 0.5;
          if (tooShort || tooNarrow) {
            const label = (element.textContent ?? '').trim().slice(0, 30);
            problems.push(`${selector} «${label}» is ${Math.round(box.width)}×${Math.round(box.height)} px`);
          }
        }
      }
      return problems;
    },
    { selectors: TOUCH_TARGETS, wide: WIDE_TARGETS as readonly string[], size: TOUCH_TARGET_PX },
  );
}

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

async function expectToFit(page: Page, label: string, touch: boolean) {
  expect(await layoutProblems(page), label).toEqual([]);
  if (touch) expect(await smallTouchTargets(page), `${label}: touch targets under 44 px`).toEqual([]);
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
        // A hash change alone keeps the document, and the previous route's title would satisfy the wait below (and
        // two routes share «Mi garaje»): every route is measured from a fresh load of its own URL.
        await page.goto('about:blank');
        await page.goto(`./#${path}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectToFit(page, path, viewport.touch);
      }
      // The running mock exam: forty questions of three options each.
      await page.goto('about:blank');
      await page.goto('./#/teorico?semilla=1');
      await page.getByRole('button', { name: 'Empezar el simulacro' }).click();
      await expect(page.getByRole('radio')).toHaveCount(120);
      await expectToFit(page, '/teorico running', viewport.touch);
    });

    test('3D pages keep their layout inside the screen', async ({ page }) => {
      test.setTimeout(4 * SOFTWARE_WEBGL_TIMEOUT_MS);
      // The exam page around the cabin (examiner, guide, readings) is checked without waiting for the city.
      await page.goto('./#/examen');
      await expect(page.getByTestId('exam-hud')).toBeVisible();
      await expectToFit(page, '/examen', viewport.touch);

      await page.goto('about:blank');
      await page.goto('./#/recorrido');
      await expect(page.getByTestId('city-preview')).toHaveAttribute('data-state', 'ready', {
        timeout: SOFTWARE_WEBGL_TIMEOUT_MS,
      });
      await expectToFit(page, '/recorrido', viewport.touch);

      // The practice yard has the same cabin, pedals and controls as the exam, and loads fastest.
      await page.goto('about:blank');
      await page.goto('./#/pista');
      const view = page.getByTestId('driving-canvas');
      await expect(view).toHaveAttribute('data-state', 'ready', { timeout: SOFTWARE_WEBGL_TIMEOUT_MS });
      await expectToFit(page, '/pista', viewport.touch);
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
