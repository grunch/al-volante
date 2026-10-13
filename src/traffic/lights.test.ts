import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { buildCity } from '../city/model.ts';
import { createRandom } from '../activities/random.ts';
import {
  CYCLE_PERIOD_S,
  SIGNAL_CYCLE,
  controlLights,
  createSignalPlan,
  crosswalkLight,
  groupLight,
  intersectionLight,
  redRemainingS,
} from './lights.ts';
import { buildNetwork } from './network.ts';

const network = buildNetwork(buildCity(RouteSchema.parse(routeData)));

describe('signal plans', () => {
  it('gives every signalled intersection a seeded offset inside the cycle', () => {
    const plan = createSignalPlan(network, createRandom(7));
    const signalled = network.intersections.filter((item) => item.kind === 'signal');
    expect(Object.keys(plan.cycles)).toHaveLength(signalled.length);
    expect(signalled.length).toBe(5);
    for (const cycle of Object.values(plan.cycles)) {
      expect(cycle.offsetS).toBeGreaterThanOrEqual(0);
      expect(cycle.offsetS).toBeLessThan(CYCLE_PERIOD_S);
    }
    expect(createSignalPlan(network, createRandom(7))).toEqual(plan);
    expect(createSignalPlan(network, createRandom(8))).not.toEqual(plan);
  });

  it('never shows green to both streets and clears the crossing street before its green', () => {
    const cycle = { ...SIGNAL_CYCLE, offsetS: 5 };
    for (let timeS = 0; timeS < CYCLE_PERIOD_S * 2; timeS += 0.25) {
      const main = groupLight(cycle, 0, timeS);
      const cross = groupLight(cycle, 1, timeS);
      expect(main === 'red' || cross === 'red').toBe(true);
      if (main === 'red') expect(redRemainingS(cycle, 0, timeS)).toBeGreaterThan(0);
      else expect(redRemainingS(cycle, 0, timeS)).toBe(0);
    }
    // Main green starts the cycle; one second of all-red, then the crossing street's green, then its yellow.
    expect(groupLight(cycle, 0, -5)).toBe('green');
    expect(groupLight(cycle, 1, -5 + SIGNAL_CYCLE.greenS + SIGNAL_CYCLE.yellowS)).toBe('red');
    expect(groupLight(cycle, 1, -5 + SIGNAL_CYCLE.greenS + SIGNAL_CYCLE.yellowS + 1)).toBe('green');
    expect(groupLight(cycle, 1, -5 + CYCLE_PERIOD_S - 1)).toBe('yellow');
    expect(redRemainingS(cycle, 1, -5)).toBe(SIGNAL_CYCLE.greenS + SIGNAL_CYCLE.yellowS + 1);
  });

  it('phases both groups from the cycle it is given, not from the default plan', () => {
    // Arrange: a 54 s cycle (20 green, 4 yellow, 30 red) where group 0's green starts at time 0.
    const cycle = { greenS: 20, yellowS: 4, redS: 30, offsetS: 0 };
    const periodS = 54;

    // Act / Assert: group 1 is red until one all-red second after group 0's yellow, green, then yellow for 4 s.
    expect(groupLight(cycle, 0, 19.5)).toBe('green');
    expect(groupLight(cycle, 0, 23.5)).toBe('yellow');
    expect(groupLight(cycle, 0, 24.5)).toBe('red');
    expect(groupLight(cycle, 1, 24.5)).toBe('red');
    expect(groupLight(cycle, 1, 25.5)).toBe('green');
    expect(groupLight(cycle, 1, 49.5)).toBe('green');
    expect(groupLight(cycle, 1, 50.5)).toBe('yellow');
    expect(groupLight(cycle, 1, 53.5)).toBe('yellow');
    expect(groupLight(cycle, 1, periodS + 0.5)).toBe('red');
    expect(redRemainingS(cycle, 0, 30)).toBe(periodS - 30);
    expect(redRemainingS(cycle, 1, 10)).toBe(25 - 10);
    expect(redRemainingS(cycle, 1, periodS + 10)).toBe(25 - 10);
    for (let timeS = 0; timeS < periodS * 2; timeS += 0.25) {
      const main = groupLight(cycle, 0, timeS);
      const cross = groupLight(cycle, 1, timeS);
      expect(main === 'red' || cross === 'red').toBe(true);
      expect(redRemainingS(cycle, 0, timeS) > 0).toBe(main === 'red');
      expect(redRemainingS(cycle, 1, timeS) > 0).toBe(cross === 'red');
    }
  });

  it('reports the lamps of signals by their control and of signalled crossings by their road', () => {
    const plan = createSignalPlan(network, createRandom(1));
    const lights = controlLights(plan, network, 12);
    expect(Object.keys(lights).sort()).toEqual([
      'control-0',
      'control-1',
      'control-11',
      'control-13',
      'control-2',
      'control-3',
      'control-4',
      'control-8',
    ]);
    // Cabildo's crossing after the Quesada corner is red exactly while Quesada may go.
    for (let timeS = 0; timeS < CYCLE_PERIOD_S; timeS += 0.5) {
      const now = controlLights(plan, network, timeS);
      if (now['control-0'] === 'green') expect(now['control-1']).toBe('red');
      if (now['control-1'] === 'green') expect(now['control-0']).toBe('red');
    }
  });

  it('gives a crosswalk the light of its host crossing for its street, and none without a signalled host', () => {
    // Arrange
    const plan = createSignalPlan(network, createRandom(1));
    const hosted = network.crosswalks.find((crosswalk) => crosswalk.controlId === 'control-1')!;
    const unsignalled = network.crosswalks.find((crosswalk) => crosswalk.intersectionId === null)!;
    const cycle = plan.cycles[hosted.intersectionId!]!;
    const stopCrossing = network.intersections.find((intersection) => intersection.kind === 'stop')!;

    // Act / Assert
    for (let timeS = 0; timeS < CYCLE_PERIOD_S; timeS += 0.5)
      expect(crosswalkLight(plan, hosted, timeS)).toBe(groupLight(cycle, hosted.group, timeS));
    expect(crosswalkLight(plan, unsignalled, 0)).toBeNull();
    // A plan without that crossing (another network's) lights nothing rather than guessing.
    expect(crosswalkLight({ cycles: {} }, hosted, 0)).toBeNull();
    expect(intersectionLight(plan, stopCrossing, 0, 0)).toBeNull();
  });
});
