/** Cabin controls are independent of exam scoring and drivetrain physics. */
export const MIRROR_IDS = ['left', 'center', 'right'] as const;
export type MirrorId = (typeof MIRROR_IDS)[number];
export type Toggle = 'belt' | 'hazards' | 'wipers' | 'defogger' | 'rearHeater' | 'airConditioning' | 'heating' | 'door';
export type Adjustment = 'seatDistance' | 'seatHeight' | 'headrest';
export interface CockpitState {
  seatDistance: number;
  seatHeight: number;
  headrest: number;
  mirrors: Record<MirrorId, { yaw: number; pitch: number }>;
  lookYaw: number;
  lookPitch: number;
  belt: boolean;
  lights: 'off' | 'position' | 'low' | 'high';
  signal: 'off' | 'left' | 'right';
  hazards: boolean;
  wipers: boolean;
  defogger: boolean;
  rearHeater: boolean;
  airConditioning: boolean;
  heating: boolean;
  horn: boolean;
  /** The driver's door, opened to get out at the end of the exam (protocolo PDF 13). */
  door: boolean;
}
export type CockpitCommand =
  | { type: 'toggle'; control: Toggle }
  | { type: 'adjust'; control: Adjustment; value: number }
  | { type: 'mirror'; mirror: MirrorId; axis: 'yaw' | 'pitch'; value: number }
  | { type: 'look'; yaw: number; pitch: number }
  | { type: 'lights'; value: CockpitState['lights'] }
  | { type: 'signal'; value: CockpitState['signal'] }
  | { type: 'horn'; value: boolean };

export function initialCockpit(): CockpitState {
  return {
    seatDistance: 0.5,
    seatHeight: 0.5,
    headrest: 0.5,
    mirrors: { left: { yaw: 0, pitch: 0 }, center: { yaw: 0, pitch: 0 }, right: { yaw: 0, pitch: 0 } },
    lookYaw: 0,
    lookPitch: 0,
    belt: false,
    lights: 'off',
    signal: 'off',
    hazards: false,
    wipers: false,
    defogger: false,
    rearHeater: false,
    airConditioning: false,
    heating: false,
    horn: false,
    door: false,
  };
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export function commandCockpit(state: CockpitState, command: CockpitCommand): CockpitState {
  switch (command.type) {
    case 'toggle':
      return { ...state, [command.control]: !state[command.control] };
    case 'adjust':
      return Number.isFinite(command.value) ? { ...state, [command.control]: clamp(command.value, 0, 1) } : state;
    case 'mirror':
      return Number.isFinite(command.value)
        ? {
            ...state,
            mirrors: {
              ...state.mirrors,
              [command.mirror]: { ...state.mirrors[command.mirror], [command.axis]: clamp(command.value, -0.45, 0.45) },
            },
          }
        : state;
    case 'look':
      return Number.isFinite(command.yaw) && Number.isFinite(command.pitch)
        ? { ...state, lookYaw: clamp(command.yaw, -2.35, 2.35), lookPitch: clamp(command.pitch, -0.55, 0.55) }
        : state;
    case 'lights':
      return { ...state, lights: command.value };
    case 'signal':
      return { ...state, signal: command.value };
    case 'horn':
      return { ...state, horn: command.value };
  }
}
