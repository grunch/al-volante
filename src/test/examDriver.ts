import { commandCockpit, initialCockpit } from '../practice/cockpit.ts';
import type { CockpitCommand, CockpitState } from '../practice/cockpit.ts';
import { EXAM_START, createSession, observe } from '../exam/session.ts';
import type { Course, Observation, Session } from '../exam/session.ts';
import { command, initialCarState, stepCar } from '../sim/car.ts';
import type { CarControls, CarEvent, CarState } from '../sim/car.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import type { AutomaticLever, ManualGear, PowertrainCommand, TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { createScenarioState, stepScenario } from '../sim/scenario.ts';
import type { ScenarioState } from '../sim/scenario.ts';
import { PRACTICE_YARD } from '../sim/tracks/practiceYard.ts';
import { EXAM_CAR, bodyBox } from '../sim/vehicle.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import type { World } from '../sim/world.ts';
import { REAL_RULES } from './realRules.ts';

export const IDLE: CarControls = { throttle: 0, brake: 0, clutch: 0, steer: 0 };

/** A scripted driver: the car, the cabin and the session advance together, step by step. */
export class Driver {
  session: Session;
  car: CarState;
  cockpit: CockpitState = initialCockpit();

  scenario: ScenarioState | null;

  constructor(
    readonly kind: TransmissionKind,
    seed = 7,
    readonly world: World = PRACTICE_YARD,
    start: VehicleState = EXAM_START,
    course: Course | null = null,
  ) {
    this.session = createSession(REAL_RULES, kind, seed, course);
    this.car = initialCarState(start, kind);
    this.scenario = world.scenario ? createScenarioState(world.scenario) : null;
    // Stage I starts with the key in contact (protocolo PDF 9), as the exam page does.
    this.drive({ type: 'insert-key' }, { type: 'turn-key', to: 'on' });
  }

  see(observation: Observation) {
    this.session = observe(this.session, observation);
  }

  cabin(value: CockpitCommand) {
    const before = this.cockpit;
    this.cockpit = commandCockpit(before, value);
    this.see({ type: 'cockpit', command: value, before, after: this.cockpit });
  }

  drive(...commands: PowertrainCommand[]) {
    for (const next of commands) {
      const result = command(this.car, next);
      this.car = result.state;
      this.see({
        type: 'step',
        car: this.car,
        cockpit: this.cockpit,
        events: result.events,
        dt: 0,
        scenario: this.scenario,
      });
    }
  }

  hold(controls: CarControls, until: (car: CarState, elapsedS: number) => boolean, maxS = 20) {
    for (let t = 0; t < maxS; t += SIM_STEP_S) {
      if (until(this.car, t)) return;
      const result = stepCar(this.world, this.car, controls, SIM_STEP_S);
      this.car = result.state;
      const events: CarEvent[] = [...result.events];
      if (this.world.scenario && this.scenario) {
        const { vehicle, timeS } = this.car.world;
        this.scenario = stepScenario(this.world.scenario, this.scenario, bodyBox(EXAM_CAR, vehicle), timeS);
        events.push(...this.scenario.contacts.map((actor) => ({ type: 'actor-contact' as const, actor })));
      }
      this.see({
        type: 'step',
        car: this.car,
        cockpit: this.cockpit,
        events,
        dt: SIM_STEP_S,
        scenario: this.scenario,
      });
    }
    throw new Error(`condition not met in ${maxS} s`);
  }

  ready() {
    this.see({ type: 'ready' });
  }

  get faults() {
    return this.session.ledger.faults.map((fault) => fault.ruleId);
  }

  get phase() {
    return this.session.phase;
  }

  /** Answers every recognition prompt, correctly or through `wrong`. */
  recognise(wrong: Record<string, string> = {}): string[] {
    const targets: string[] = [];
    while (this.session.phase === 'recognition') {
      const prompt = this.session.prompt;
      if (prompt?.kind !== 'recognise') throw new Error('expected a recognition prompt');
      targets.push(prompt.target);
      this.answer(wrong[prompt.target] ?? prompt.target);
    }
    return targets;
  }

  answer(target: string) {
    if (target === 'clutch' || target === 'brake' || target === 'throttle') {
      this.hold({ ...IDLE, [target]: 1 }, (_, t) => t > 0.1);
      this.hold(IDLE, (_, t) => t > 0.1);
    } else if (target.startsWith('gear-')) {
      const to = target.slice(5) as ManualGear | AutomaticLever;
      this.hold(this.kind === 'manual' ? { ...IDLE, clutch: 1 } : { ...IDLE, brake: 1 }, (_, t) => t > 0.1);
      this.drive({ type: 'shift', to });
      this.hold(IDLE, (_, t) => t > 0.1);
    } else if (target === 'position' || target === 'low' || target === 'high') {
      this.cabin({ type: 'lights', value: target });
    } else if (target === 'signal-left' || target === 'signal-right') {
      this.cabin({ type: 'signal', value: target === 'signal-left' ? 'left' : 'right' });
    } else if (target === 'horn') {
      this.cabin({ type: 'horn', value: true });
    } else {
      this.cabin({
        type: 'toggle',
        control: target as 'hazards' | 'wipers' | 'defogger' | 'rearHeater' | 'airConditioning',
      });
    }
  }

  /** Stage I done properly: adjustments, mirrors, belt, low beams. */
  prepareProperly() {
    this.cabin({ type: 'adjust', control: 'seatDistance', value: 0.6 });
    this.cabin({ type: 'adjust', control: 'headrest', value: 0.6 });
    for (const mirror of ['left', 'center', 'right'] as const)
      this.cabin({ type: 'mirror', mirror, axis: 'yaw', value: 0.1 });
    this.cabin({ type: 'toggle', control: 'belt' });
    this.cabin({ type: 'lights', value: 'low' });
    this.ready();
  }

  startEngine() {
    const held = this.kind === 'manual' ? { ...IDLE, clutch: 1 } : { ...IDLE, brake: 1 };
    this.hold(held, (_, t) => t > 0.2);
    this.drive({ type: 'turn-key', to: 'start' });
    this.hold(held, (_, t) => t > 0.5);
  }

  /** Moves the signed distance along the heading with the technique the protocol asks for, then stops. */
  moveInBox(metres: number) {
    const startZ = this.car.world.vehicle.z;
    const reverse = metres < 0;
    const reached = (car: CarState) =>
      reverse ? car.world.vehicle.z <= startZ + metres : car.world.vehicle.z >= startZ + metres;
    if (this.kind === 'manual') {
      this.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
      this.drive({ type: 'shift', to: reverse ? 'R' : '1' }, { type: 'handbrake', engaged: false });
      this.hold({ ...IDLE, clutch: 0.68 }, reached);
      this.hold({ ...IDLE, clutch: 1, brake: 1 }, (car) => car.world.vehicle.speedMps === 0);
      this.hold({ ...IDLE, clutch: 1, brake: 1 }, (_, t) => t > 1);
    } else {
      this.hold({ ...IDLE, brake: 1 }, (_, t) => t > 0.1);
      this.drive({ type: 'shift', to: reverse ? 'R' : 'D' }, { type: 'handbrake', engaged: false });
      // Easing off the brake lets the converter creep the car; braking again stops it.
      this.hold({ ...IDLE, brake: 0.05 }, reached);
      this.hold({ ...IDLE, brake: 1 }, (car) => car.world.vehicle.speedMps === 0);
      this.hold({ ...IDLE, brake: 1 }, (_, t) => t > 1);
    }
  }

  /** Drives out of the box to the left (+x) in one forward manoeuvre, straightens up in the lane and stops. */
  driveOut() {
    if (this.kind === 'manual') {
      this.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
      this.drive({ type: 'shift', to: '1' });
    }
    // Manual: pull away at the biting point, then let the clutch up. Straight until the whole body is past the
    // front posts (turning earlier swings the side into them), then left, then straight again along the lane.
    if (this.kind === 'manual') {
      this.hold({ ...IDLE, clutch: 0.7, throttle: 0.4 }, (car) => car.world.vehicle.speedMps > 0.3, 5);
      this.hold({ ...IDLE, clutch: 0.6, throttle: 0.5 }, (car) => car.world.vehicle.speedMps > 1.5, 8);
    }
    const pedals: CarControls = { ...IDLE, throttle: 0.25 };
    const boxFrontZ = Math.max(...this.world.obstacles.filter((o) => o.kind === 'pole').map((o) => o.box.centerZ));
    this.hold(pedals, (car) => car.world.vehicle.z > boxFrontZ + 1, 30);
    // A short swing (about 35°), a straight stretch to gain the lane, and back to the heading of the street: a
    // full-lock swing would put the nose into the left kerb of a 10 m street.
    this.hold({ ...pedals, steer: 1 }, (car) => car.world.vehicle.headingRad >= 0.6, 30);
    this.hold(pedals, (car) => car.world.vehicle.x > -2, 30);
    this.hold({ ...pedals, steer: -1 }, (car) => car.world.vehicle.headingRad <= 0.02, 30);
    this.hold({ ...IDLE, brake: 1, clutch: 1 }, (car) => car.world.vehicle.speedMps === 0);
  }

  /** Puts the car elsewhere in the box, as a test fixture. */
  place(x: number) {
    this.car = { ...this.car, world: { ...this.car.world, vehicle: { ...this.car.world.vehicle, x } } };
  }
}
