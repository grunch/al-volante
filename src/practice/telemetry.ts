import type { CarEvent } from '../sim/car.ts';
import { TRACK_COPY } from '../i18n/es-AR.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
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

/** Plain-language feedback for each simulation event. */
export function describeEvent(event: CarEvent, kind: TransmissionKind): string {
  const events = TRACK_COPY.events;
  switch (event.type) {
    case 'contact':
      return TRACK_COPY.contact(TRACK_COPY.obstacleNames[event.kind]);
    case 'start-refused':
      if (event.reason === 'key') return events.startKey;
      if (event.reason === 'running') return events.startRunning;
      return kind === 'manual' ? events.startInGearManual : events.startInGearAutomatic;
    case 'shift-refused': {
      const refusals: Record<typeof event.reason, string> = {
        clutch: events.shiftClutch,
        brake: events.shiftBrake,
        moving: events.shiftMoving,
        invalid: events.shiftInvalid,
      };
      return refusals[event.reason];
    }
    case 'handbrake':
      return event.engaged ? events.handbrakeOn : events.handbrakeOff;
    case 'engine-started':
    case 'engine-stopped':
    case 'stall':
    case 'moved-with-handbrake':
    case 'key-removed':
    case 'key-refused':
      return events[event.type];
    default:
      return '';
  }
}
