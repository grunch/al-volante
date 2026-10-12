import { ACTIONS } from './bindings.ts';
import type { Action, Bindings } from './bindings.ts';
import { KEY_LABELS, KEY_SEPARATOR } from '../i18n/drivingGuide.ts';

/** The keys of every action as the driver reads them, for the driving guide (F04-T05-FIX01). */
export type KeyNames = Record<Action, string>;

/** The name of a key code on screen: letters and digits as themselves, arrows, Shift and Space by name. */
export function keyLabel(code: string): string {
  const character = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(code);
  if (character) return character[1] ?? character[2] ?? code;
  const label = KEY_LABELS[code];
  // bindings.ts only accepts the codes named here, so another one is a programming error, not a key to show raw.
  if (label === undefined) throw new Error(`no label for the key code ${code}`);
  return label;
}

/** Every action named with its keys, e.g. "↑ o W"; two codes with the same name (both Shift keys) read once. */
export function keyNames(bindings: Bindings): KeyNames {
  return Object.fromEntries(
    ACTIONS.map((action) => [action, [...new Set(bindings[action].map(keyLabel))].join(KEY_SEPARATOR)]),
  ) as KeyNames;
}
