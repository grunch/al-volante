import * as THREE from 'three';
import type { CityControl } from './model.ts';
import { CITY_COLORS as c } from './palette.ts';
import { CITY_COPY } from '../i18n/es-AR.ts';
import { createBlenderModel } from '../scene/blenderAssets.ts';
import type { LightState } from '../sim/scenario.ts';

const LAMP_STATES: readonly LightState[] = ['red', 'yellow', 'green'];
const LAMP_COLORS: Record<LightState, string> = { red: '#e03b2e', yellow: '#f2c230', green: '#2ec46a' };

/** Canvas text is original content; DOM text in the route panel supplies its accessible equivalent. */
export function label(text: string, width: number, height: number, background: string): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = background;
    context.fillRect(0, 0, 512, 128);
    context.fillStyle = '#ffffff';
    context.font = 'bold 54px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 256, 64, 490);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
}

/** Lights the lens of `state` on a signal head created by `createControl`; `null` switches all lenses off. */
export function lightControl(group: THREE.Object3D, state: LightState | null): void {
  for (const lamp of LAMP_STATES) {
    const lens = group.getObjectByName(`lens-${lamp}`);
    if (!(lens instanceof THREE.Mesh) || !(lens.material instanceof THREE.MeshBasicMaterial)) continue;
    lens.material.color.set(lamp === state ? LAMP_COLORS[lamp] : c.inactive);
  }
}

/** Controls drawn as a signal head: corner lights and signalled crosswalks, which carry their own vehicle light. */
export const isSignalControl = (type: string): boolean =>
  type === 'traffic_signals' || type === 'crossing-traffic_signals';

export function createControl(control: CityControl): THREE.Group {
  const group = new THREE.Group();
  group.name = control.id;
  group.userData = { type: control.type, status: control.status, sourcePosition: control.sourcePosition };
  group.position.set(control.position.x, 0, control.position.z);
  group.rotation.y = control.road.headingRad;
  if (control.type !== 'stop' && !isSignalControl(control.type)) return group;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 3, 8),
    new THREE.MeshStandardMaterial({ color: c.steel }),
  );
  pole.position.y = 1.5;
  if (control.type === 'stop') group.add(pole);
  else {
    pole.geometry.dispose();
    pole.material.dispose();
  }
  if (control.type === 'stop') {
    const plate = new THREE.Mesh(
      new THREE.CircleGeometry(0.46, 8, Math.PI / 8),
      new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }),
    );
    plate.position.set(0, 2.4, -0.06);
    group.add(plate);
    const red = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 8, Math.PI / 8),
      new THREE.MeshBasicMaterial({ color: c.red, side: THREE.DoubleSide }),
    );
    red.position.set(0, 2.4, -0.07);
    group.add(red);
    const text = label(CITY_COPY.stop, 0.64, 0.18, c.red);
    text.position.set(0, 2.4, -0.08);
    text.rotation.y = Math.PI;
    group.add(text);
  } else {
    group.add(createBlenderModel('signal'));
    // Lenses start unlit; `lightControl` lights one of them from the traffic state (F04-T02).
    LAMP_STATES.forEach((state, index) => {
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.116, 24),
        new THREE.MeshBasicMaterial({ color: c.inactive, side: THREE.DoubleSide, toneMapped: false }),
      );
      lens.name = `lens-${state}`;
      lens.position.set(0, 2.96 - index * 0.31, -0.23);
      group.add(lens);
    });
  }
  const street = label(control.road.street, 2.2, 0.42, c.steel);
  street.position.set(0, 3.35, 0);
  street.rotation.y = Math.PI;
  group.add(street);
  return group;
}
