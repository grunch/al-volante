import { test as base } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';

export { expect } from '@playwright/test';

/**
 * Removes `navigator.serviceWorker`, as in a browser without service workers: the app then registers nothing and
 * shows none of its installation notices. Playwright's `serviceWorkers: 'block'` instead makes registration fail,
 * which the app rightly reports with a notice that would cover what these specs click.
 */
export async function withoutServiceWorkers(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Reflect.deleteProperty(Navigator.prototype, 'serviceWorker');
  });
}

/** The `test` of every spec but pwa.spec.ts, which installs the app for real. */
export const test = base.extend({
  // Named `provide`, not `use`, so the React hooks lint rule does not take Playwright's callback for a hook.
  context: async ({ context }, provide) => {
    await withoutServiceWorkers(context);
    await provide(context);
  },
});
