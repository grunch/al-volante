/** Path of a figure crop under public/ (and relative to the app base): `fig.manual-p51-beacons` → `figures/…png`. */
export function figureFile(figureId: string): string {
  return `figures/${figureId.replace(/^fig\./, '')}.png`;
}
