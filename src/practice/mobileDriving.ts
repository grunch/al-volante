export const MOBILE_QUERY = '(pointer: coarse) and (hover: none)';
export const MOBILE_SETTINGS_KEY = 'al-volante.mobile-driving.v1';
export interface MobileSettings {
  tiltEnabled: boolean;
  fullLockDeg: number;
  vibration: boolean;
}
export const DEFAULT_MOBILE_SETTINGS: MobileSettings = { tiltEnabled: true, fullLockDeg: 75, vibration: true };

export function parseMobileSettings(raw: string | null): MobileSettings {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (typeof value !== 'object' || value === null) return DEFAULT_MOBILE_SETTINGS;
    const item = value as Record<string, unknown>;
    if (
      typeof item.tiltEnabled !== 'boolean' ||
      typeof item.vibration !== 'boolean' ||
      typeof item.fullLockDeg !== 'number' ||
      !Number.isFinite(item.fullLockDeg) ||
      item.fullLockDeg < 45 ||
      item.fullLockDeg > 90
    )
      return DEFAULT_MOBILE_SETTINGS;
    return { tiltEnabled: item.tiltEnabled, fullLockDeg: item.fullLockDeg, vibration: item.vibration };
  } catch {
    return DEFAULT_MOBILE_SETTINGS;
  }
}

/** Only the primary pointer opts in; a desktop exposing DeviceMotionEvent does not. */
export function isMobileDriving(): boolean {
  return typeof matchMedia === 'function' && matchMedia(MOBILE_QUERY).matches;
}
