import { expect, it } from 'vitest';
import { CITY, cruise, throughTheBox } from '../test/circuitDriver.ts';
import { driveFrame, startDriving } from './drivingLoop.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import { trafficOf } from '../sim/world.ts';
import type { CarControls } from '../sim/car.ts';
import { createTraffic, trafficSourceOf } from '../traffic/traffic.ts';
import { buildCircuit } from '../exam/circuit.ts';
import { Driver } from '../test/examDriver.ts';

it('drives the entire circuit with continuous pedals and assisted shifts without stalling', () => {
  // Isolate the mobile powertrain from the test driver's actor-yielding heuristics. Keep signals and road geometry.
  const traffic = { ...createTraffic(CITY, 1), vehicles: [], walks: {}, emergency: null };
  const circuit = buildCircuit(CITY, traffic);
  const world = { ...CITY.world, traffic: trafficSourceOf(traffic) };
  const exam = { traffic, circuit, driver: new Driver('manual', 1, world, CITY.start.pose, circuit) };
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
