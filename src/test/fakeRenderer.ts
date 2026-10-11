import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type { SceneRenderer } from '../scene/SceneCanvas.tsx';

export interface FakeRenderer extends SceneRenderer {
  setPixelRatio: Mock<SceneRenderer['setPixelRatio']>;
  setSize: Mock<SceneRenderer['setSize']>;
  render: Mock<SceneRenderer['render']>;
  dispose: Mock<SceneRenderer['dispose']>;
}

/** Renderer double that records calls instead of touching WebGL. */
export function createFakeRenderer(): FakeRenderer {
  return {
    domElement: document.createElement('canvas'),
    setPixelRatio: vi.fn<SceneRenderer['setPixelRatio']>(),
    setSize: vi.fn<SceneRenderer['setSize']>(),
    render: vi.fn<SceneRenderer['render']>(),
    dispose: vi.fn<SceneRenderer['dispose']>(),
  };
}
