import { KEY_BINDINGS } from './controls.ts';

export const DEFAULT_BINDINGS = {
  ...KEY_BINDINGS,
  lookLeft: ['KeyJ'],
  lookRight: ['KeyL'],
  lookBack: ['KeyB'],
  lookCenter: ['KeyI'],
  glanceLeft: ['KeyU'],
  glanceRight: ['KeyP'],
  belt: ['KeyC'],
  lights: ['KeyO'],
  signalLeft: ['KeyZ'],
  signalRight: ['KeyX'],
  hazards: ['KeyV'],
  wipers: ['KeyF'],
  horn: ['KeyH'],
  door: ['KeyG'],
} as const;
export type Action = keyof typeof DEFAULT_BINDINGS;
export const ACTIONS = Object.keys(DEFAULT_BINDINGS) as Action[];
export type Bindings = Record<Action, readonly string[]>;
export const BINDINGS_STORAGE_KEY = 'al-volante.controls.v1';
export const HOLD_ACTIONS: ReadonlySet<Action> = new Set(['throttle', 'brake', 'left', 'right', 'clutch', 'horn']);
export const DRIVE_COMMANDS: ReadonlySet<Action> = new Set(['key', 'handbrake', 'gearUp', 'gearDown']);
export function actionForCode(bindings: Bindings, code: string): Action | undefined {
  return ACTIONS.find((action) => bindings[action].includes(code));
}
/** Reserve browser navigation, shortcuts and Tab; only single game keys may be assigned. */
export function validCode(code: string): boolean {
  return /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Space)$/.test(code);
}
export function rebind(bindings: Bindings, action: Action, code: string): Bindings | null {
  if (!validCode(code) || ACTIONS.some((other) => other !== action && bindings[other].includes(code))) return null;
  return { ...bindings, [action]: [code] };
}
export function parseBindings(raw: string | null): Bindings {
  try {
    const candidate: unknown = JSON.parse(raw ?? 'null');
    if (typeof candidate !== 'object' || candidate === null) return DEFAULT_BINDINGS;
    const entries = candidate as Record<string, unknown>;
    const used = new Set<string>();
    for (const action of ACTIONS) {
      const codes = entries[action];
      if (!Array.isArray(codes) || codes.length === 0 || codes.length > 2) return DEFAULT_BINDINGS;
      for (const code of codes) {
        if (typeof code !== 'string' || !validCode(code) || used.has(code)) return DEFAULT_BINDINGS;
        used.add(code);
      }
    }
    return Object.fromEntries(ACTIONS.map((action) => [action, entries[action]])) as Bindings;
  } catch {
    return DEFAULT_BINDINGS;
  }
}
/** Translate user inputs to the existing drivetrain adapter, preserving its fixed-step ramps. */
export function drivingKeys(actions: Iterable<Action>): Set<string> {
  const result = new Set<string>();
  for (const action of actions)
    if (action in KEY_BINDINGS) result.add(KEY_BINDINGS[action as keyof typeof KEY_BINDINGS][0]);
  return result;
}
