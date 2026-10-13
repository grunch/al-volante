import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerSW } from 'virtual:pwa-register';
import { fakeServiceWorker } from '../test/fakeServiceWorker.ts';
import { startServiceWorker } from './registerServiceWorker.ts';
import { createUpdateStore } from './updates.ts';

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn(() => () => Promise.resolve()) }));

function spiedStore() {
  const store = createUpdateStore(fakeServiceWorker().environment);
  return { store, start: vi.spyOn(store, 'start') };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.restoreAllMocks();
});

describe('startServiceWorker', () => {
  it('registers the generated worker in a production build of a browser that supports it', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: new EventTarget(), configurable: true });
    const { store, start } = spiedStore();

    startServiceWorker(store, true);

    expect(start).toHaveBeenCalledWith(registerSW);
  });

  it('leaves the development server and the tests without a worker', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: new EventTarget(), configurable: true });
    const { store, start } = spiedStore();

    startServiceWorker(store);

    expect(import.meta.env.PROD).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it('does nothing in a browser without service workers', () => {
    const { store, start } = spiedStore();

    startServiceWorker(store, true);

    expect('serviceWorker' in navigator).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });
});
