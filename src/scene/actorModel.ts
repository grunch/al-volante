import * as THREE from 'three';
import { createBlenderModel } from './blenderAssets.ts';
import type { ActorKind } from '../sim/scenario.ts';

/** Blender silhouettes fit the evaluated footprint, including mirrors, shoes and handlebars. */
export function decorateActor(root: THREE.Mesh, kind: ActorKind, width: number, length: number, height: number) {
  const model = createBlenderModel(kind === 'vehicle' ? 'car' : kind);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const visualHeight = kind === 'bicycle' ? 1.78 : height;
  const scale = new THREE.Vector3(width / size.x, visualHeight / size.y, length / size.z);
  // Shoes and faces retain their proportions: pedestrians need not fill a square collision box.
  if (kind === 'pedestrian' || kind === 'bicycle') scale.setScalar(Math.min(scale.x, scale.y, scale.z));
  model.scale.copy(scale);
  model.position.set(-center.x * scale.x, -height / 2 - bounds.min.y * scale.y, -center.z * scale.z);
  const materials = Array.isArray(root.material) ? root.material : [root.material];
  materials.forEach((material) => {
    material.visible = false;
  });
  root.add(model);
  // Contact occlusion follows actors; moving silhouettes never leave ghosts in the cached city shadows.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.98, length * 0.98),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader:
        'varying vec2 vShadowUv; void main() { vShadowUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'varying vec2 vShadowUv; void main() { vec2 p = vShadowUv * 2.0 - 1.0; float alpha = (1.0 - smoothstep(0.12, 1.0, dot(p, p))) * 0.23; gl_FragColor = vec4(0.04, 0.055, 0.055, alpha); }',
    }),
  );
  shadow.name = 'actor-contact-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.075 - height / 2;
  root.add(shadow);
  // Stable variation per actor. It never consumes the traffic simulation's random sequence.
  let hash = 0;
  for (const char of root.name) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  const paints = ['#dae0dc', '#a9c1cc', '#d5b4a8', '#b7c0a4', '#b4b9c4'];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) object.castShadow = false;
    if (
      object instanceof THREE.Mesh &&
      object.material instanceof THREE.MeshStandardMaterial &&
      object.name.endsWith('-paint') &&
      kind === 'vehicle'
    )
      object.material.color.set(paints[hash % paints.length] ?? '#ffffff');
  });
}
