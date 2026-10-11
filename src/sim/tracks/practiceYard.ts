import { DRY_ASPHALT } from '../dynamics.ts';
import { restingVehicle } from '../vehicle.ts';
import type { World } from '../world.ts';

/**
 * A closed yard to try the simulation: walls around it, a kerb on the right and a 6 m parking box (protocol graphic
 * 4, protocolo PDF 21) marked by four posts. The box width (2.4 m) and post size (10 cm) are game approximations
 * (REGLAS.md, V5). Heading 0 faces +z; +x is the driver's left.
 */
const post = (id: string, x: number, z: number) => ({
  id,
  kind: 'pole' as const,
  box: { centerX: x, centerZ: z, halfLengthM: 0.05, halfWidthM: 0.05, headingRad: 0 },
});

const wall = (id: string, centerX: number, centerZ: number, halfLengthM: number, halfWidthM: number) => ({
  id,
  kind: 'wall' as const,
  box: { centerX, centerZ, halfLengthM, halfWidthM, headingRad: 0 },
});

/** Painted outline of the parking box, 10 cm lines inside the 6 m between the posts. */
const LINE_M = 0.1;
const line = (centerX: number, centerZ: number, halfLengthM: number, halfWidthM: number) => ({
  centerX,
  centerZ,
  halfLengthM,
  halfWidthM,
  headingRad: 0,
});

export const PRACTICE_YARD: World = {
  surface: DRY_ASPHALT,
  obstacles: [
    wall('wall-north', 0, 40.25, 0.25, 15.5),
    wall('wall-south', 0, -10.25, 0.25, 15.5),
    wall('wall-east', -15.25, 15, 25.5, 0.25),
    wall('wall-west', 15.25, 15, 25.5, 0.25),
    {
      id: 'kerb',
      kind: 'curb',
      box: { centerX: -6.55, centerZ: 15, halfLengthM: 20, halfWidthM: 0.15, headingRad: 0 },
    },
    post('box-front-kerb', -6.3, 16),
    post('box-front-lane', -4, 16),
    post('box-rear-kerb', -6.3, 10),
    post('box-rear-lane', -4, 10),
  ],
  markings: [
    line(-6.3, 13, 3, LINE_M / 2),
    line(-4, 13, 3, LINE_M / 2),
    line(-5.15, 10 + LINE_M / 2, LINE_M / 2, 1.15),
    line(-5.15, 16 - LINE_M / 2, LINE_M / 2, 1.15),
  ],
};

export const PRACTICE_YARD_START = restingVehicle({ x: 0, z: 0, headingRad: 0 });
