/**
 * Engine and clutch of a typical 1.6 l petrol exam car. Values are game approximations (ARQUITECTURA.md, «Tren
 * motriz»): they reproduce the behaviours the protocol cares about (idle, creep, stalling) rather than a model.
 */
export interface EngineSpec {
  idleRpm: number;
  /** Below this, an engine dragged by the wheels dies. */
  stallRpm: number;
  /** Fuel cut. */
  maxRpm: number;
  inertiaKgM2: number;
  /** Full-throttle torque by rpm, interpolated linearly and flat outside the table. */
  torqueCurve: ReadonlyArray<readonly [rpm: number, torqueNm: number]>;
  /** Most the idle controller adds to keep the engine running under load. */
  idleTorqueMaxNm: number;
  idleGainNmPerRadS: number;
  frictionNm: number;
  frictionNmPerRadS: number;
}

export const EXAM_ENGINE: EngineSpec = {
  idleRpm: 850,
  stallRpm: 450,
  maxRpm: 6200,
  inertiaKgM2: 0.15,
  torqueCurve: [
    [1000, 95],
    [2000, 115],
    [3500, 130],
    [5000, 125],
    [6200, 105],
  ],
  idleTorqueMaxNm: 45,
  idleGainNmPerRadS: 2.5,
  frictionNm: 8,
  frictionNmPerRadS: 0.02,
};

export const rpmToRadS = (rpm: number) => (rpm * 2 * Math.PI) / 60;
export const radSToRpm = (radS: number) => (radS * 60) / (2 * Math.PI);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function curveAt(spec: EngineSpec, rpm: number): number {
  const curve = spec.torqueCurve;
  const first = curve[0] as readonly [number, number];
  const last = curve[curve.length - 1] as readonly [number, number];
  if (rpm <= first[0]) return first[1];
  if (rpm >= last[0]) return last[1];
  const upper = curve.findIndex(([at]) => at >= rpm);
  const [rpmA, torqueA] = curve[upper - 1] as readonly [number, number];
  const [rpmB, torqueB] = curve[upper] as readonly [number, number];
  return torqueA + ((torqueB - torqueA) * (rpm - rpmA)) / (rpmB - rpmA);
}

export function frictionTorqueNm(spec: EngineSpec, omegaRadS: number): number {
  return spec.frictionNm + spec.frictionNmPerRadS * Math.max(0, omegaRadS);
}

/**
 * Torque the combustion produces: what the accelerator asks for, but never less than what the idle controller adds
 * to hold idle (enough to cancel friction at idle, more as the engine drops below it, up to a cap).
 */
export function combustionTorqueNm(spec: EngineSpec, omegaRadS: number, throttle: number): number {
  const rpm = radSToRpm(omegaRadS);
  if (rpm >= spec.maxRpm) return 0;
  const idleOmega = rpmToRadS(spec.idleRpm);
  const idle = clamp(
    frictionTorqueNm(spec, idleOmega) + spec.idleGainNmPerRadS * (idleOmega - omegaRadS),
    0,
    spec.idleTorqueMaxNm,
  );
  return Math.max(clamp(throttle, 0, 1) * curveAt(spec, rpm), idle);
}

/** Net torque on the crankshaft: combustion minus internal friction (negative = engine braking). */
export function engineTorqueNm(spec: EngineSpec, omegaRadS: number, throttle: number): number {
  return combustionTorqueNm(spec, omegaRadS, throttle) - frictionTorqueNm(spec, omegaRadS);
}

/** Pedal travel (1 = pressed to the floor) above which the clutch transmits nothing. */
export const CLUTCH_FREE_PEDAL = 0.75;
/** Pedal travel below which the clutch grips fully. */
export const CLUTCH_GRIP_PEDAL = 0.3;

/**
 * Share of the clutch torque capacity a pedal position gives: zero from the floor to 0.75, rising smoothly (the
 * biting point is just below 0.75) to full grip at 0.3 and above.
 */
export function clutchEngagement(pedal: number): number {
  const travel = clamp((CLUTCH_FREE_PEDAL - pedal) / (CLUTCH_FREE_PEDAL - CLUTCH_GRIP_PEDAL), 0, 1);
  return travel * travel * (3 - 2 * travel);
}
