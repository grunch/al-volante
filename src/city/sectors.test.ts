import { sectorKey, sectorDistance, SectorSet } from './sectors.ts';

describe('city sector streaming', () => {
  it('uses floor coordinates on both sides of the origin', () => {
    expect(sectorKey({ x: -1, z: -129 })).toBe('-1:-2');
    expect(sectorKey({ x: 128, z: 0 })).toBe('1:0');
    expect(sectorDistance('0:0', { x: 64, z: 64 })).toBe(0);
    expect(sectorDistance('0:0', { x: -3, z: -4 })).toBe(5);
  });
  it('rejects keys that are not two integers', () => {
    expect(() => sectorDistance('a:b', { x: 0, z: 0 })).toThrow('Invalid sector key');
    expect(() => sectorDistance('3', { x: 0, z: 0 })).toThrow('Invalid sector key');
  });
  it('loads ahead of the fog, retains a hysteresis margin and releases departed sectors', () => {
    const load = vi.fn(),
      unload = vi.fn();
    const stream = new SectorSet(['0:0', '4:0', '8:0'], load, unload);
    stream.update({ x: 64, z: 64 });
    expect(load.mock.calls).toEqual([['0:0']]);
    stream.update({ x: 350, z: 64 });
    expect(stream.active.has('0:0')).toBe(true);
    stream.update({ x: 600, z: 64 });
    expect(unload).toHaveBeenCalledWith('0:0');
    expect(stream.active).toEqual(new Set(['4:0']));
    stream.update({ x: 64, z: 64 });
    expect(load.mock.calls.filter(([id]) => id === '0:0')).toHaveLength(2);
    stream.dispose();
    expect(stream.active.size).toBe(0);
  });
});
