import type { CarEvent } from '../sim/car.ts';
import type { PowertrainState } from '../sim/powertrain/powertrain.ts';

/** What the practice yard shows about the car; free of Three.js so the page can use it without the 3D chunk. */
export interface Telemetry {
  speedKmh: number;
  odometerM: number;
  rpm: number;
  powertrain: PowertrainState;
  /** Latest event worth telling the driver about (a stall, a refused shift, a contact…), if any. */
  lastEvent: CarEvent | null;
}

/** Gear as the driver reads it: the manual gear, or the lever (with the gear the automatic is in, in D). */
export function gearLabel(powertrain: PowertrainState): string {
  if (powertrain.kind === 'manual') return powertrain.manualGear;
  return powertrain.lever === 'D' ? `D${powertrain.autoGear}` : powertrain.lever;
}
