import { test, expect } from '../e2e/fixtures.ts';
import { BrowserDriver } from './browserDriver.ts';

test('rejects an interrupted exam even when the waiting condition is met', async ({ page }, info) => {
  const driver = new BrowserDriver(page, 'automatic', info);
  await driver.open();
  const stopped = { ...(await driver.read()), phase: 'finished', speed: 0 };
  // Inject an observation into the harness without changing the game's state.
  driver.read = async () => stopped;
  await expect(driver.until((read) => read.speed === 0, 5, 'Stop after the route')).rejects.toThrow(
    'exam finished unexpectedly',
  );
});
