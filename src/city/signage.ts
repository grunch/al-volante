import * as THREE from 'three';
import type { CityControl } from './model.ts';
import { CITY_COLORS as c } from './palette.ts';
import { CITY_COPY } from '../i18n/es-AR.ts';

/** Canvas text is original content; DOM text in the route panel supplies its accessible equivalent. */
function label(text: string, width: number, height: number, background: string): THREE.Mesh {
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

export function createControl(control: CityControl): THREE.Group {
  const group = new THREE.Group();
  group.name = control.id;
  group.userData = { type: control.type, status: control.status, sourcePosition: control.sourcePosition };
  group.position.set(control.position.x, 0, control.position.z);
  group.rotation.y = control.road.headingRad;
  if (control.type !== 'stop' && control.type !== 'traffic_signals') return group;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 3, 8),
    new THREE.MeshStandardMaterial({ color: c.steel }),
  );
  pole.position.y = 1.5;
  group.add(pole);
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
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 1.04, 0.24),
      new THREE.MeshStandardMaterial({ color: c.steel }),
    );
    housing.position.set(0, 2.65, -0.1);
    group.add(housing);
    // Unlit heads intentionally carry no permission to proceed. Signal cycles belong to F04-T02.
    for (const y of [2.34, 2.65, 2.96]) {
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 12),
        new THREE.MeshBasicMaterial({ color: c.inactive, side: THREE.DoubleSide }),
      );
      lens.position.set(0, y, -0.23);
      group.add(lens);
    }
  }
  const street = label(control.road.street, 2.2, 0.42, c.steel);
  street.position.set(0, 3.35, 0);
  street.rotation.y = Math.PI;
  group.add(street);
  return group;
}
