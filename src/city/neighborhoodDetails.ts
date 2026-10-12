import type { City } from './model.ts';
import { offsetPoint, roadBox } from './model.ts';
import { overlaps } from '../sim/collision.ts';
import { planFrontages } from './frontages.ts';
import type { Part } from './geometry.ts';
import type { StreetLabel } from './streetFurniture.ts';
import { NEIGHBORHOOD_COPY } from '../i18n/es-AR.ts';

/** Original detail from the chronological reference sequence; no photo pixels, logos or personal data. */
export function neighborhoodDetails(city: City): { parts: Part[]; labels: StreetLabel[] } {
  const parts: Part[] = [],
    labels: StreetLabel[] = [];
  const labelled = new Set<number>();
  for (const [index, front] of planFrontages(city).entries()) {
    const { road, side, center, depthM, widthM } = front;
    const face = offsetPoint(center, road.headingRad, (-side * depthM) / 2);
    const add = (x: number, y: number, z: number, size: Part['size'], color: string) => {
      const p = offsetPoint(face, road.headingRad, -side * x, z);
      parts.push({
        shape: 'box',
        position: [p.x, y, p.z],
        size,
        heading: road.headingRad,
        color,
        detailDistanceM: 50,
      });
    };
    // Door furniture, pipework and ceramic plinths remain recognizable at driver's eye height.
    add(0.075, 0.43, 0, [0.12, 0.56, widthM - 0.3], index % 2 ? '#6b6b60' : '#676052');
    add(0.14, 1.38, -widthM * 0.31, [0.065, 0.24, 0.12], '#a3a69a');
    for (let row = 0; row < 4; row++) add(0.179, 1.46 - row * 0.045, -widthM * 0.31, [0.008, 0.014, 0.055], '#303b36');
    add(0.1, 1.34, widthM * 0.4, [0.04, 2.4, 0.09], '#666e65');
    add(0.14, 0.22, widthM * 0.4, [0.2, 0.11, 0.1], '#666e65');
    if (!front.shops) {
      // Ground-floor ironwork and a small entry gate, not repeated on every upper-storey window.
      for (let bar = 0; bar < 9; bar++) add(0.24, 1.5, -1.4 + bar * 0.18, [0.035, 1.48, 0.022], '#313b36');
      for (const y of [0.82, 2.18]) add(0.24, y, -0.68, [0.045, 0.035, 1.52], '#313b36');
      add(0.21, 0.52, widthM * 0.22, [0.3, 0.32, 1.05], '#83624c');
      for (let plant = 0; plant < 5; plant++)
        add(0.21, 0.77, widthM * 0.22 - 0.4 + plant * 0.2, [0.23, 0.25, 0.18], '#536f42');
    }
    if (front.shops && road.leg !== null && !labelled.has(road.leg)) {
      labelled.add(road.leg);
      const p = offsetPoint(face, road.headingRad, -side * 0.19);
      labels.push({
        text: NEIGHBORHOOD_COPY.shops[(road.leg - 1) % NEIGHBORHOOD_COPY.shops.length] ?? NEIGHBORHOOD_COPY.shops[0],
        position: [p.x, 2.8, p.z],
        heading: road.headingRad - (side * Math.PI) / 2,
        widthM: Math.min(4.2, widthM * 0.6),
        heightM: 0.48,
        background: index % 2 ? '#475e53' : '#703f38',
      });
    }
    if (index % 3 === 0) {
      const p = offsetPoint(face, road.headingRad, -side * 2.6, widthM * 0.25);
      const footprint = { centerX: p.x, centerZ: p.z, halfWidthM: 0.9, halfLengthM: 1.2, headingRad: road.headingRad };
      if (!city.roads.some((r) => overlaps(footprint, roadBox(r, r.cycleTrack ? 2.6 : 0.25)))) {
        const model = index % 9 === 0 ? 'container' : index % 9 === 3 ? 'scooter' : 'bikeRack';
        parts.push({
          shape: 'box',
          model,
          color: '#ffffff',
          position: [p.x, 0.14, p.z],
          size: [1, 1, 1],
          heading: road.headingRad,
          detailDistanceM: 65,
        });
      }
    }
    // Thin, sagging utility spans follow facades above the pedestrian clearance envelope.
    if (index % 2 === 0) {
      const span = widthM - 0.4;
      for (let piece = 0; piece < 6; piece++) {
        const t = (piece + 0.5) / 6,
          y = 5.8 - Math.sin(t * Math.PI) * 0.24;
        add(1.5, y, -span / 2 + t * span, [0.022, 0.022, span / 6 + 0.025], '#444e49');
      }
      add(1.5, 5.72, -span / 2, [0.1, 0.44, 0.1], '#636d61');
    }
  }
  for (const [index, obstacle] of city.world.obstacles.filter((o) => o.kind === 'vehicle').entries()) {
    const b = obstacle.box;
    parts.push({
      shape: 'box',
      model: 'car',
      position: [b.centerX, 0.04, b.centerZ],
      size: [1, 1, 1],
      heading: b.headingRad,
      color: ['#f1f0e8', '#777f85', '#434c55', '#a2afb3', '#8b5c57', '#bec2b7'][index % 6] ?? '#f1f0e8',
    });
  }
  return { parts, labels };
}
