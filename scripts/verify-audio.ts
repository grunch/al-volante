import assert from 'node:assert/strict';
import type { createDrivingAudio as CreateDrivingAudio } from '../src/audio/drivingAudio.ts';
import { chromium } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { createServer } from 'vite';
import type { SoundMix } from '../src/audio/soundscape.ts';

/** Real Chromium PCM checks complement the fast resource/lifecycle unit tests. */
const server = await createServer({ server: { host: '127.0.0.1', port: 4198, strictPort: true } });
let browser: Browser | undefined;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4198/');
  const silent: SoundMix = {
    engineHz: 35,
    engineGain: 0,
    roadGain: 0,
    windGain: 0,
    horn: false,
    traffic: [],
    cues: [],
  };
  const cases: [string, SoundMix, number][] = [
    ['silence', silent, 1],
    ['horn', { ...silent, horn: true }, 0.5],
    ['start', { ...silent, cues: ['start'] }, 0.5],
    ['engine', { ...silent, engineGain: 0.2, roadGain: 0.1, windGain: 0.04 }, 0.5],
    ['muted', { ...silent, horn: true, engineGain: 0.2, cues: ['start'] }, 0],
    [
      'left-traffic',
      { ...silent, traffic: [{ id: 'car', gain: 1, pan: -0.8, frequency: 80, speed: 10, siren: false, horn: false }] },
      0.5,
    ],
    [
      'right-traffic',
      { ...silent, traffic: [{ id: 'car', gain: 1, pan: 0.8, frequency: 80, speed: 10, siren: true, horn: true }] },
      0.5,
    ],
  ];
  for (const [name, mix, volume] of cases) {
    const result = await page.evaluate(
      async ({ mix, volume }) => {
        const modulePath = '/src/audio/drivingAudio.ts';
        const { createDrivingAudio } = (await import(modulePath)) as { createDrivingAudio: typeof CreateDrivingAudio };
        const context = new OfflineAudioContext(2, 48000, 48000);
        const graph = createDrivingAudio(context);
        graph.volume(volume);
        graph.update(mix);
        const buffer = await context.startRendering();
        const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
        const rms = (data: Float32Array) => Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
        const peak = channels.reduce((max, data) => data.reduce((max, v) => Math.max(max, Math.abs(v)), max), 0);
        graph.dispose();
        return { left: rms(buffer.getChannelData(0)), right: rms(buffer.getChannelData(1)), peak };
      },
      { mix, volume },
    );
    assert(Number.isFinite(result.peak) && result.peak < 1, `${name}: nonfinite or clipped output`);
    if (name === 'silence' || name === 'muted') assert(result.peak === 0, `${name}: audible output`);
    else assert(result.left + result.right > 0.001, `${name}: unexpectedly silent`);
    if (name === 'left-traffic') assert(result.left > result.right * 2, 'Left traffic must sound on the left');
    if (name === 'right-traffic') assert(result.right > result.left * 2, 'Right traffic must sound on the right');
    console.log(JSON.stringify({ name, ...result }));
  }
} finally {
  await browser?.close();
  await server.close();
}
