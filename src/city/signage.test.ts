import * as THREE from 'three';
import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { disposeScene } from '../scene/dispose.ts';
import { buildCity } from './model.ts';
import { CITY_COLORS } from './palette.ts';
import { createControl, label, lightControl } from './signage.ts';

const city = buildCity(RouteSchema.parse(routeData));

/** A 2D context that records what is painted, in order. */
function recordingContext() {
  const calls: string[] = [];
  const context = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: (...args: number[]) => calls.push(`rect ${context.fillStyle} ${args.join(',')}`),
    fillText: (text: string, x: number, y: number, maxWidth: number) =>
      calls.push(`text ${context.fillStyle} ${context.font} ${context.textAlign} ${text} ${x},${y},${maxWidth}`),
  };
  return { context, calls };
}

afterEach(() => vi.restoreAllMocks());

describe('street signage', () => {
  it('paints a plaque as centred white text on its background, sized in metres', () => {
    // Arrange
    const { context, calls } = recordingContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);

    // Act
    const plaque = label('Quesada', 2.5, 0.4, '#123456') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

    // Assert
    expect(calls).toEqual(['rect #123456 0,0,512,128', 'text #ffffff bold 54px sans-serif center Quesada 256,64,490']);
    expect(plaque.geometry.parameters).toMatchObject({ width: 2.5, height: 0.4 });
    expect(plaque.material.map).toBeInstanceOf(THREE.CanvasTexture);
    expect(plaque.material.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(plaque.material.side).toBe(THREE.DoubleSide);
    disposeScene(plaque);
  });

  it('builds a STOP sign facing the incoming traffic and lights only signal heads', () => {
    // Arrange
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const stop = city.controls.find((control) => control.type === 'stop')!;
    const signal = city.controls.find((control) => control.type === 'traffic_signals')!;

    // Act
    const sign = createControl(stop);
    const head = createControl(signal);
    lightControl(sign, 'red');
    lightControl(head, 'yellow');

    // Assert: the sign stands on the control, turned to its road, with its face on the side of arriving drivers.
    expect(sign.position.x).toBe(stop.position.x);
    expect(sign.position.z).toBe(stop.position.z);
    expect(sign.rotation.y).toBe(stop.road.headingRad);
    const faces = sign.children.filter((child) => child.position.y === 2.4);
    expect(faces).toHaveLength(3);
    expect(faces.every((face) => face.position.z < 0)).toBe(true);
    expect(sign.getObjectByName('lens-red')).toBeUndefined();
    const lit = (['red', 'yellow', 'green'] as const).map(
      (lamp) => ((head.getObjectByName(`lens-${lamp}`) as THREE.Mesh).material as THREE.MeshBasicMaterial).color,
    );
    expect(lit.map((color) => color.getHexString())).toEqual(['1d282b', 'f2c230', '1d282b']);
    expect(`#${lit[0]!.getHexString()}`).toBe(CITY_COLORS.inactive);
    disposeScene(sign);
    disposeScene(head);
  });

  it('draws only a positioned anchor for controls that carry no sign', () => {
    const hump = city.controls.find((control) => control.type === 'traffic-calming-hump')!;
    const anchor = createControl(hump);
    expect(anchor.children).toHaveLength(0);
    expect(anchor.name).toBe(hump.id);
    expect(anchor.userData).toEqual({ type: hump.type, status: hump.status, sourcePosition: hump.sourcePosition });
  });
});
