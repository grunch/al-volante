import * as THREE from 'three';
import { COCKPIT_COPY } from '../i18n/es-AR.ts';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Original compact-car interior. Dimensions and finishes are visual approximations, not a vehicle scan. */
export function createCabinInterior(cabin: THREE.Group) {
  const stationary: THREE.Mesh[] = [];
  const textures: THREE.Texture[] = [];
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function box(
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    color: string,
    parent: THREE.Object3D = cabin,
    radius = 0.015,
  ) {
    let material = materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.78 });
      materials.set(color, material);
    }
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map((s) => s / 3))),
      material,
    );
    mesh.name = name;
    mesh.position.set(...position);
    parent.add(mesh);
    if (parent === cabin) stationary.push(mesh);
    return mesh;
  }
  box('dashboard-top', [1.67, 0.18, 0.63], [0, 1.01, 1.04], '#252a2d', cabin, 0.07);
  box('dashboard-lower', [1.63, 0.33, 0.36], [0, 0.82, 0.88], '#353b3e', cabin, 0.06);
  box('dashboard-trim', [1.58, 0.014, 0.016], [0, 0.995, 0.715], '#8a9397');
  box('glovebox', [0.6, 0.17, 0.025], [-0.45, 0.81, 0.687], '#252a2d');
  box('glovebox-handle', [0.1, 0.012, 0.02], [-0.45, 0.87, 0.666], '#737c80');
  box('footwell', [1.63, 0.07, 1.8], [0, 0.26, 0], '#171b1e');
  box('center-tunnel', [0.24, 0.25, 1.1], [-0.1, 0.43, 0.1], '#252a2d', cabin, 0.06);
  box('center-console', [0.27, 0.43, 0.25], [-0.1, 0.72, 0.66], '#252a2d', cabin, 0.03);
  box('console-screen', [0.2, 0.1, 0.018], [-0.1, 0.9, 0.521], '#10181d');
  for (const x of [-0.16, -0.04]) box('climate-dial', [0.046, 0.046, 0.023], [x, 0.77, 0.52], '#70787b', cabin, 0.022);
  const hood = box('hood', [1.6, 0.11, 0.89], [0, 0.88, 1.69], '#46585a', cabin, 0.045);
  hood.rotation.x = 0.035;
  box('roof', [1.7, 0.065, 2.1], [0, 1.79, -0.18], '#a5a5a0', cabin, 0.025);
  box('rear-shelf', [1.64, 0.1, 0.4], [0, 1.03, -1.5], '#353b3e');
  for (const side of [-1, 1]) {
    const pillar = box('windshield-pillar', [0.067, 0.77, 0.073], [side * 0.8, 1.41, 1.07], '#969992', cabin, 0.025);
    pillar.rotation.x = -0.34;
    box('door-panel', [0.08, 0.59, 1.95], [side * 0.82, 0.7, -0.04], '#353b3e', cabin, 0.025);
    box('window-sill', [0.1, 0.065, 1.96], [side * 0.82, 1.035, -0.04], '#252a2d');
    box('door-armrest', [0.14, 0.085, 0.55], [side * 0.74, 0.73, -0.09], '#252a2d');
    box('door-handle', [0.022, 0.035, 0.16], [side * 0.769, 0.92, 0.43], '#9ca3a4');
    box('rear-pillar', [0.09, 0.7, 0.13], [side * 0.8, 1.4, -1.25], '#969992');
    box('sun-visor', [0.55, 0.032, 0.19], [side * 0.4, 1.742, 0.67], '#92958f');
  }
  for (const x of [-0.7, -0.12, 0.72]) {
    box('air-vent', [0.18, 0.074, 0.03], [x, 1.01, 0.703], '#11171b');
    for (let i = 0; i < 4; i++) box('vent-slat', [0.16, 0.004, 0.035], [x, 0.985 + i * 0.016, 0.68], '#686f70');
  }
  const seat = new THREE.Group();
  seat.name = 'driver-seat';
  cabin.add(seat);
  box('seat-back', [0.48, 0.68, 0.17], [0.37, 0.87, -0.48], '#42484b', seat, 0.065);
  const headrest = box('headrest', [0.29, 0.21, 0.13], [0.37, 1.4, -0.48], '#42484b', seat, 0.04);
  box('passenger-seat', [0.49, 0.68, 0.17], [-0.4, 0.87, -0.48], '#42484b', cabin, 0.065);
  box('passenger-headrest', [0.29, 0.21, 0.13], [-0.4, 1.4, -0.48], '#42484b', cabin, 0.04);
  const belt = box('seat-belt', [0.045, 0.7, 0.015], [0.37, 0.93, -0.37], '#161b1e', seat, 0.002);
  belt.rotation.z = -0.55;

  const wheel = new THREE.Group();
  wheel.name = 'steering-wheel';
  wheel.position.set(0.37, 0.995, 0.4);
  cabin.add(wheel);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.024, 10, 48),
    new THREE.MeshStandardMaterial({ color: '#202427', roughness: 0.7 }),
  );
  wheel.add(rim);
  box('wheel-spoke', [0.32, 0.054, 0.042], [0, -0.007, 0], '#363d40', wheel);
  const spoke = box('wheel-spoke-lower', [0.06, 0.14, 0.035], [0, -0.105, 0.008], '#747c7e', wheel);
  spoke.rotation.x = -0.1;
  box('wheel-airbag', [0.14, 0.11, 0.065], [0, -0.008, -0.032], '#262d30', wheel, 0.03);
  for (const side of [-1, 1]) {
    box('wheel-switch', [0.043, 0.021, 0.015], [side * 0.115, 0.001, -0.029], '#939a9a', wheel);
    box('control-stalk', [0.16, 0.026, 0.03], [0.37 + side * 0.18, 0.985, 0.49], '#252a2d');
  }
  box('instrument-hood', [0.59, 0.09, 0.23], [0.37, 1.24, 0.88], '#252a2d', cabin, 0.04);
  box('instrument-housing', [0.6, 0.2, 0.09], [0.37, 1.115, 0.84], '#171c20', cabin, 0.05);
  const needles = [0.225, 0.51].map((x, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = typeof CanvasRenderingContext2D === 'undefined' ? null : canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#11191e';
      ctx.fillRect(0, 0, 256, 256);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 24; i++) {
        const angle = -2.3 + (i / 24) * 4.6;
        const major = i % 2 === 0;
        ctx.strokeStyle = index === 1 && i > 20 ? '#db715e' : '#d5dcdd';
        ctx.lineWidth = major ? 3 : 1.5;
        ctx.beginPath();
        ctx.moveTo(128 + Math.sin(angle) * (major ? 99 : 107), 128 - Math.cos(angle) * (major ? 99 : 107));
        ctx.lineTo(128 + Math.sin(angle) * 116, 128 - Math.cos(angle) * 116);
        ctx.stroke();
        if (major && (index === 0 || i % 4 === 0)) {
          ctx.font = '18px sans-serif';
          ctx.fillStyle = '#d5dcdd';
          ctx.fillText(String(index === 0 ? i * 5 : i / 4), 128 + Math.sin(angle) * 80, 128 - Math.cos(angle) * 80);
        }
      }
      ctx.font = '16px sans-serif';
      ctx.fillText(index === 0 ? COCKPIT_COPY.speed : COCKPIT_COPY.instrumentRpmScale, 128, 176);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.113, 40), new THREE.MeshBasicMaterial({ map: texture }));
    dial.rotation.y = Math.PI;
    dial.position.set(x, 1.115, 0.779);
    cabin.add(dial);
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.115, 0.771);
    cabin.add(pivot);
    box('gauge-needle', [0.006, 0.084, 0.006], [0, 0.03, 0], '#ee775a', pivot, 0.001);
    return pivot;
  });

  // Merge stationary trim by material: detailing should not cost a draw call for every vent slat.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const mesh of stationary) {
    mesh.updateMatrix();
    mesh.geometry.applyMatrix4(mesh.matrix);
    const material = mesh.material as THREE.Material;
    const geometries = batches.get(material) ?? [];
    geometries.push(mesh.geometry);
    batches.set(material, geometries);
    mesh.removeFromParent();
  }
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries);
    if (!merged) throw new Error('Cabin geometry could not be merged');
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'cabin-trim';
    cabin.add(mesh);
    geometries.forEach((geometry) => geometry.dispose());
  }
  return { seat, headrest, belt, wheel, needles, dispose: () => textures.forEach((texture) => texture.dispose()) };
}
