import { createBlenderModel, readBlenderSurface } from './blenderAssets.ts';

/**
 * A generated kit whose car indexes a vertex it does not have and whose asphalt height field is short: the loader
 * must refuse both instead of uploading broken buffers.
 */
vi.mock('../assets/blender/city-kit.json?raw', () => {
  const base64 = (array: ArrayBufferView) =>
    btoa(String.fromCharCode(...new Uint8Array(array.buffer, array.byteOffset, array.byteLength)));
  const triangle = (index: number[]) => ({
    finish: 'matte',
    position: base64(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])),
    normal: base64(new Int16Array([0, 0, 32767, 0, 0, 32767, 0, 0, 32767])),
    color: base64(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255])),
    index: base64(new Uint16Array(index)),
  });
  // Every asset of `ASSET_NAMES` (the schema demands them all; the mock factory cannot import it).
  const names = [
    'car',
    'bus',
    'emergency',
    'pedestrian',
    'bicycle',
    'tree',
    'treeSparse',
    'signal',
    'window',
    'aircon',
    'drain',
    'manhole',
    'treeLow',
    'treeSparseLow',
    'carLow',
    'windowLow',
    'container',
    'scooter',
    'bikeRack',
  ];
  const models = Object.fromEntries(names.map((name) => [name, [triangle(name === 'car' ? [0, 1, 3] : [0, 1, 2])]]));
  const height = (length: number) => base64(new Uint8Array(length));
  return {
    default: JSON.stringify({
      version: 1,
      generator: 'test',
      models,
      surfaces: { asphalt: { size: 256, height: height(100) }, sidewalk: { size: 256, height: height(256 * 256) } },
    }),
  };
});

describe('Blender kit validation', () => {
  it('refuses geometry whose indices point past its vertices', () => {
    expect(() => createBlenderModel('car')).toThrow('Invalid Blender geometry: car');
    expect(createBlenderModel('bus').children).toHaveLength(1);
  });

  it('refuses a height field that does not fill its declared size', () => {
    expect(() => readBlenderSurface('asphalt')).toThrow('Invalid Blender surface: asphalt');
    expect(readBlenderSurface('sidewalk').height).toHaveLength(256 * 256);
  });
});
