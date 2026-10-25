import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { Page, TestInfo } from '@playwright/test';
import { EXAM_COPY, COCKPIT_COPY } from '../../src/i18n/es-AR.ts';
import { DEFAULT_BINDINGS } from '../../src/practice/bindings.ts';
import type { Action } from '../../src/practice/bindings.ts';
import type { TransmissionKind } from '../../src/sim/powertrain/powertrain.ts';
import type { TrafficSnapshot, ActorPose } from '../../src/sim/scenario.ts';
import { overlaps } from '../../src/sim/collision.ts';

export interface Reading {
  time: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
  odometer: number;
  steer: number;
  clutch: number;
  brake: number;
  throttle: number;
  gear: string;
  engine: string;
  handbrake: boolean;
  phase: string;
  leg: string;
  traffic: TrafficSnapshot | null;
  feedback: string;
}

/** Drives only through browser keyboard/buttons. It never assigns car, session or traffic state. */
export class BrowserDriver {
  readonly canvas;
  readonly held = new Set<Action>();
  readonly samples: Omit<Reading, 'traffic'>[] = [];
  private lastSampleTime = -1;
  private lastPhase = '';
  private lastLeg = '';
  private latest: Reading | null = null;

  constructor(
    readonly page: Page,
    readonly kind: TransmissionKind,
    readonly info: TestInfo,
  ) {
    this.canvas = page.getByTestId('driving-canvas');
  }

  async open() {
    await this.page.goto('./#/examen/practico');
    await expect(this.canvas).toHaveAttribute('data-state', 'ready');
    if (this.kind === 'automatic') {
      await this.page.getByRole('radio', { name: 'Automática', exact: true }).check();
      await expect(this.canvas).toHaveAttribute('data-gear', 'P');
    }
    // Fast-forwarding fires one animation frame while the unmodified loop runs its fixed 120 Hz physics steps.
    // Each advance is at most 100 ms: no elapsed time is dropped by the simulation's 12-step cap.
    await this.page.clock.install();
    await this.page.clock.pauseAt(new Date(Date.now() + 1000));
    await this.canvas.focus();
  }

  async read(): Promise<Reading> {
    const {
      data: raw,
      phase,
      leg,
      feedback,
    } = await this.canvas.evaluate((el) => ({
      data: { ...(el as HTMLElement).dataset } as Record<string, string | undefined>,
      phase: document.querySelector('[data-testid="examiner-says"]')?.getAttribute('data-phase') ?? '',
      leg: document.querySelector('[data-testid="exam-leg"]')?.textContent ?? '',
      feedback: document.querySelector('[data-testid="driving-feedback"]')?.textContent ?? '',
    }));
    const traffic = raw.traffic ? (JSON.parse(raw.traffic) as TrafficSnapshot) : null;
    if (traffic)
      traffic.poses = traffic.poses.map((pose) => ({ ...pose, inside: (box) => overlaps(pose.box, box) }) as ActorPose);
    const read: Reading = {
      time: Number(raw.timeS),
      x: Number(raw.positionX),
      z: Number(raw.positionZ),
      heading: Number(raw.headingRad),
      speed: Number(raw.speedKmh) / 3.6,
      odometer: Number(raw.odometerM),
      steer: Number(raw.steer),
      clutch: Number(raw.clutch),
      brake: Number(raw.brake),
      throttle: Number(raw.throttle),
      gear: raw.gear ?? '',
      engine: raw.engine ?? '',
      handbrake: raw.handbrake === 'true',
      phase,
      leg,
      traffic,
      feedback,
    };
    for (const [name, value] of Object.entries(read)) {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Invalid driving observation: ${name}`);
    }
    if (!read.phase || !read.leg || !read.gear || !read.engine) throw new Error('Driving observations are incomplete');
    this.latest = read;
    if (read.time - this.lastSampleTime >= 1 || read.phase !== this.lastPhase || read.leg !== this.lastLeg) {
      const { traffic: observations, ...sample } = read;
      void observations;
      this.samples.push(sample);
      this.lastSampleTime = read.time;
    }
    if (read.phase !== this.lastPhase || read.leg !== this.lastLeg) {
      console.log(
        `${this.kind}: ${read.time.toFixed(1)} s · ${read.phase} · ${read.leg} · ${read.odometer.toFixed(1)} m`,
      );
      this.lastPhase = read.phase;
      this.lastLeg = read.leg;
    }
    return read;
  }

  async tick(seconds = 0.1) {
    for (let remaining = seconds; remaining > 0.0001; remaining -= 0.1)
      await this.page.clock.fastForward(Math.round(Math.min(0.1, remaining) * 1000));
  }

  async hold(actions: readonly Action[]) {
    const wanted = new Set(actions);
    for (const action of this.held)
      if (!wanted.has(action)) {
        await this.page.keyboard.up(DEFAULT_BINDINGS[action][0]);
        this.held.delete(action);
      }
    for (const action of wanted)
      if (!this.held.has(action)) {
        await this.page.keyboard.down(DEFAULT_BINDINGS[action][0]);
        this.held.add(action);
      }
  }

  async press(action: Action) {
    await this.page.keyboard.press(DEFAULT_BINDINGS[action][0]);
    await this.tick();
  }

  async button(name: string) {
    const button = this.page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    await button.press('Enter');
    await this.tick();
  }

  async until(condition: (read: Reading) => boolean, maxSeconds: number, label: string) {
    const start = (await this.read()).time;
    for (let attempts = 0; attempts < Math.ceil(maxSeconds * 20); attempts++) {
      const read = await this.read();
      if (read.phase === 'finished') throw new Error(`${label}: exam finished unexpectedly: ${read.feedback}`);
      if (condition(read)) return read;
      if (read.time - start > maxSeconds)
        throw new Error(
          `${label}: timed out after ${maxSeconds} simulation seconds: ${JSON.stringify({ ...read, traffic: undefined })}`,
        );
      await this.tick();
    }
    throw new Error(`${label}: the simulation clock stopped advancing`);
  }

  async gear(target: string) {
    await this.canvas.focus();
    const sequence = this.kind === 'manual' ? ['R', 'N', '1', '2', '3', '4', '5'] : ['P', 'R', 'N', 'D'];
    await this.hold([this.kind === 'manual' ? 'clutch' : 'brake']);
    await this.tick(0.7);
    for (let attempts = 0; attempts < sequence.length; attempts++) {
      const current = (await this.read()).gear.replace(/^D\d$/, 'D');
      if (current === target) return;
      await this.press(sequence.indexOf(target) > sequence.indexOf(current) ? 'gearUp' : 'gearDown');
    }
    throw new Error(`Could not engage ${target}`);
  }

  async prepare() {
    await this.button(EXAM_COPY.ready);
    for (let count = 0; (await this.read()).phase === 'recognition'; count++) {
      if (count > 30) throw new Error('Recognition did not finish');
      const text = await this.page.getByTestId('examiner-says').innerText();
      const target = Object.entries(EXAM_COPY.prompts).find(([, prompt]) => text.startsWith(prompt))?.[0];
      if (!target) throw new Error(`Unknown recognition prompt: ${text}`);
      if (target.startsWith('gear-')) await this.gear(target.slice(5));
      else if (['clutch', 'brake', 'throttle'].includes(target)) {
        await this.canvas.focus();
        await this.hold([target as Action]);
        await this.tick(0.8);
      } else if (['position', 'low', 'high'].includes(target)) {
        await this.page.getByRole('combobox', { name: new RegExp(COCKPIT_COPY.lights) }).selectOption(target);
        await this.tick();
      } else if (target === 'signal-left' || target === 'signal-right') {
        await this.button(COCKPIT_COPY.actions[target === 'signal-left' ? 'signalLeft' : 'signalRight']);
      } else if (target === 'horn') {
        await this.canvas.focus();
        await this.press('horn');
      } else {
        await this.button(`${COCKPIT_COPY.toggles[target as keyof typeof COCKPIT_COPY.toggles]} Desactivado`);
      }
      await this.hold([]);
      await this.tick(0.8);
    }
    expect((await this.read()).phase).toBe('preparation');
    for (const name of ['Balizas Activado', COCKPIT_COPY.actions.signalLeft, COCKPIT_COPY.actions.signalRight]) {
      if (await this.page.getByRole('button', { name, exact: true, pressed: true }).count()) await this.button(name);
    }
    await this.page.getByText(COCKPIT_COPY.setup, { exact: true }).press('Enter');
    for (const label of [
      COCKPIT_COPY.seatDistance,
      COCKPIT_COPY.headrest,
      ...['left', 'center', 'right'].map(
        (side) =>
          `${COCKPIT_COPY.mirrorNames[side as keyof typeof COCKPIT_COPY.mirrorNames]}: ${COCKPIT_COPY.horizontal}`,
      ),
    ]) {
      await this.page.getByRole('slider', { name: label, exact: true }).press('ArrowRight');
    }
    await this.button(`${COCKPIT_COPY.toggles.belt} Desactivado`);
    await this.page.getByRole('combobox', { name: new RegExp(COCKPIT_COPY.lights) }).selectOption('low');
    await this.button(EXAM_COPY.ready);
    expect((await this.read()).phase).toBe('unlock');
    await this.canvas.focus();
    await this.gear(this.kind === 'manual' ? 'N' : 'P');
    await this.press('key');
    expect((await this.read()).engine).toBe('running');
    expect((await this.read()).phase).toBe('reverse');
    await this.capture('engine-started');
  }

  async capture(name: string) {
    const path = this.info.outputPath(`${name}.png`);
    await this.page.screenshot({ path, fullPage: true, animations: 'allow' });
    await this.info.attach(name, { path, contentType: 'image/png' });
  }

  async finish() {
    const path = this.info.outputPath('driving-log.json');
    await writeFile(
      path,
      JSON.stringify({ transmission: this.kind, seed: 1, samples: this.samples, latest: this.latest }, null, 2),
    );
    await this.info.attach('driving-log', {
      path,
      contentType: 'application/json',
    });
    if (this.page.isClosed()) return;
    await this.hold([]);
    await this.info.attach('exam-feedback', {
      body: await this.page.locator('main').innerText(),
      contentType: 'text/plain',
    });
  }
}
