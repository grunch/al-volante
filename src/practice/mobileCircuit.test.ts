import { expect, it } from 'vitest';
import { cityExam, cruise, throughTheBox } from '../test/circuitDriver.ts';
import { driveFrame, startDriving } from './drivingLoop.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import { trafficOf } from '../sim/world.ts';
import type { CarControls } from '../sim/car.ts';

it('drives a seeded circuit with continuous pedals and assisted shifts without stalling', () => {
  const exam = cityExam('manual', 1, { emergency: false });
  const driver = throughTheBox(exam.driver);
  let frame = startDriving(driver.car.world.vehicle, 'manual', [], undefined, trafficOf(driver.world));
  frame = {
    ...frame,
    stepper: { state: driver.car, previous: driver.car, accumulatorS: 0 },
    controls: driver.car.controls,
    scenario: driver.scenario,
  };
  let atMs = 0;
  let stalled = false;
  const step = (controls: CarControls, dt: number) => {
    atMs += dt * 1000;
    frame = driveFrame(
      driver.world,
      frame,
      new Set(),
      [],
      dt,
      undefined,
      (car, events, dt, scenario) => {
        stalled ||= events.some((event) => event.type === 'stall');
        driver.see({ type: 'step', car, events, dt, scenario, cockpit: driver.cockpit });
      },
      {
        frameEndMs: atMs,
        assistClutch: true,
        continuous: () => ({ throttle: controls.throttle, brake: controls.brake, steer: controls.steer }),
      },
    );
    driver.car = frame.stepper.state;
    driver.scenario = frame.scenario;
  };
  driver.drive = (...commands) => {
    frame = driveFrame(driver.world, frame, new Set(), [], 0, undefined, undefined, {
      frameEndMs: atMs,
      assistClutch: true,
      commands,
    });
    driver.car = frame.stepper.state;
  };
  driver.hold = (controls, until, maxS = 20) => {
    for (let elapsed = 0; elapsed < maxS; elapsed += SIM_STEP_S) {
      if (until(driver.car, elapsed)) return;
      step(controls, SIM_STEP_S);
    }
    throw new Error(`Mobile driver condition not met in ${maxS} s`);
  };
  cruise(exam, { until: (driver) => driver.phase === 'parking', maxS: 900 });
  expect(stalled).toBe(false);
  expect(driver.phase).toBe('parking');
}, 120000);
