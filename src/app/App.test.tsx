import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { createFakeRenderer } from '../test/fakeRenderer.ts';
import { esAR, t } from '../i18n/es-AR.ts';

describe('App', () => {
  it('renders the title, skip link and the garage scene region', async () => {
    render(<App createRenderer={createFakeRenderer} />);

    expect(screen.getByRole('heading', { level: 1, name: esAR.appTitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: esAR.skipToContent })).toHaveAttribute('href', '#main');
    expect(await screen.findByRole('img', { name: esAR.garageSceneLabel })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});

describe('App without an injected renderer', () => {
  it('uses the real WebGL renderer and degrades gracefully where WebGL is missing (jsdom)', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(<App />);
    await screen.findByRole('img', { name: esAR.garageSceneLabel });
    act(() => frames.shift()?.(0));

    expect(screen.getByRole('status')).toHaveTextContent(esAR.garageSceneUnavailable);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});

describe('t', () => {
  it('returns the Rioplatense Spanish copy for a key', () => {
    expect(t('garageHeading')).toBe('Mi garaje');
  });
});
