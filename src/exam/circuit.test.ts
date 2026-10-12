import { describe, expect, it } from 'vitest';
import { CITY } from '../test/circuitDriver.ts';
import { createTraffic } from '../traffic/traffic.ts';
import { pointAlong } from '../traffic/network.ts';
import { SIGNAL_BEFORE_CORNER_M, buildCircuit, distanceAlong, lateralOnRoad, legAt, roadAt } from './circuit.ts';

const circuit = buildCircuit(CITY, createTraffic(CITY, 1));
const corners = circuit.crossings.filter((crossing) => crossing.corner !== null);

describe('circuit derived from the city and its traffic network (RECORRIDO.md §4)', () => {
  it('lays the eight legs along the lap in order, with the exam limit and the posted maximum of each', () => {
    expect(circuit.legs.map((leg) => leg.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let index = 1; index < circuit.legs.length; index++)
      expect(circuit.legs[index]!.startS).toBeGreaterThanOrEqual(circuit.legs[index - 1]!.endS);
    expect(circuit.legs.map((leg) => leg.examKmh)).toEqual([30, 45, 30, 30, 30, 30, 30, 30]);
    // OSM maxima (single-source, unconfirmed): 40 on streets, 30 on Cuba and the second Quesada, 60 on Cabildo.
    expect(circuit.legs.map((leg) => leg.postedKmh)).toEqual([40, 60, 40, 30, 30, 30, 40, 40]);
    expect(circuit.legs.map((leg) => leg.lanes)).toEqual([1, 2, 1, 1, 1, 1, 2, 1]);
    expect(circuit.legs.map((leg) => leg.cycleTrack)).toEqual([false, false, false, true, true, true, false, false]);
    expect(circuit.legs.map((leg) => leg.street)).toEqual([
      'Quesada',
      'Av. Cabildo',
      'Guayra',
      'Cuba',
      'Quesada',
      'Cuba',
      'Manuel Ugarte',
      'Vuelta de Obligado',
    ]);
    expect(circuit.lap.lengthM).toBeGreaterThan(1500);
  });

  it('ends every leg at a corner with its turn, its control and a stop line just before the leg ends', () => {
    expect(corners.map((crossing) => crossing.leg)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(corners.map((crossing) => crossing.corner?.turn)).toEqual([
      'right',
      'right',
      'right',
      'left',
      'right',
      'right',
      'right',
      'left',
    ]);
    expect(corners.map((crossing) => crossing.corner?.nextStreet)).toEqual([
      'Av. Cabildo',
      'Guayra',
      'Cuba',
      'Quesada',
      'Cuba',
      'Manuel Ugarte',
      'Vuelta de Obligado',
      'Quesada',
    ]);
    // Signals at Cabildo (both corners), STOP at Guayra–Cuba, Quesada–Cuba, Ugarte–Obligado and Obligado–Quesada;
    // the other two corners have no control (right-hand priority).
    expect(corners.map((crossing) => crossing.rule)).toEqual([
      'signal',
      'signal',
      'stop',
      'priority',
      'stop',
      'priority',
      'stop',
      'stop',
    ]);
    for (const crossing of corners) {
      const leg = circuit.legs.find((item) => item.number === crossing.leg)!;
      expect(crossing.lineS).toBeLessThan(leg.endS);
      expect(crossing.lineS).toBeGreaterThan(leg.endS - 15);
      expect(crossing.pavements.length).toBeGreaterThan(0);
      expect(crossing.corner?.nextLeg).toBe((crossing.leg % 8) + 1);
    }
    expect(SIGNAL_BEFORE_CORNER_M).toBe(30);
  });

  it('keeps the mid-leg controls: the STOP of Cuba at Iberá, the signals of Congreso and the Cabildo crossings', () => {
    const midLeg = circuit.crossings.filter((crossing) => crossing.corner === null);
    expect(midLeg.map((crossing) => [crossing.leg, crossing.rule])).toEqual([
      [1, 'priority'],
      [2, 'signal'],
      [3, 'priority'],
      [4, 'stop'],
      [6, 'signal'],
      [8, 'signal'],
    ]);
    expect(circuit.crosswalks.filter((crosswalk) => crosswalk.controlId !== null).map((item) => item.leg)).toEqual([
      2, 2, 2,
    ]);
    expect(circuit.bumps).toHaveLength(1);
    expect(circuit.bumps[0]?.leg).toBe(6);
    expect(circuit.busways.length).toBeGreaterThan(0);
    expect([...circuit.solidLineLeft].every((id) => id.startsWith('leg-2-'))).toBe(true);
  });

  it('locates the car on the lap: road, leg, signed lateral offset and distance to a line', () => {
    const leg3 = circuit.legs[2]!;
    const s = leg3.startS + 50;
    expect(roadAt(circuit.lap, s)?.leg).toBe(3);
    expect(legAt(circuit, s)?.number).toBe(3);
    const { point, headingRad } = pointAlong(circuit.lap, s);
    const road = roadAt(circuit.lap, s)!;
    expect(lateralOnRoad(road, point)).toBeCloseTo(0, 1);
    const left = { x: point.x + Math.cos(headingRad) * 2, z: point.z - Math.sin(headingRad) * 2 };
    expect(lateralOnRoad(road, left)).toBeCloseTo(2, 1);
    const corner = corners[2]!;
    expect(distanceAlong(circuit, s, corner.lineS)).toBeCloseTo(corner.lineS - s, 5);
    expect(distanceAlong(circuit, corner.lineS + 5, corner.lineS)).toBeCloseTo(-5, 5);
    // Inside a corner link there is no road under the car.
    expect(roadAt(circuit.lap, circuit.legs[0]!.endS + 0.5)).toBeNull();
  });
});
