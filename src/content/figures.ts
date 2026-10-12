/** Path of a figure crop under public/ (and relative to the app base): `fig.manual-p51-beacons` → `figures/…png`. */
export function figureFile(figureId: string): string {
  return `figures/${figureId.replace(/^fig\./, '')}.png`;
}

/** Path of a sign crop under public/: `sign.regulatory.priority.stop` → `signs/regulatory.priority.stop.png`. */
export function signFile(signId: string): string {
  return `signs/${signId.replace(/^sign\./, '')}.png`;
}

/** A crop must stay inside its page; a tiny tolerance absorbs rounding in hand-measured boxes. */
export function boxInsidePage(box: { x: number; y: number; width: number; height: number }): boolean {
  return box.x + box.width <= 1.0001 && box.y + box.height <= 1.0001;
}
