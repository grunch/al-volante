import { test, expect } from '../e2e/fixtures.ts';
import { BrowserDriver } from './browserDriver.ts';
import { throughBox, driveRoute } from './routeDriver.ts';

for (const kind of ['manual', 'automatic'] as const) {
  test(`${kind}: plays the practical exam from the controls`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const driver = new BrowserDriver(page, kind, info);
    try {
      await driver.open();
      await driver.prepare();
      await throughBox(driver);
      await driveRoute(driver);
      expect(errors).toEqual([]);
    } finally {
      await driver.finish();
    }
  });
}
