import { describe, expect, it } from 'vitest';
import { cityExam, cruise, descend, parkInTheBay, stopInDoubleFile } from '../test/circuitDriver.ts';
import { IDLE } from '../test/examDriver.ts';
import { buildCard } from './card.ts';
import { resultOf } from './scoring.ts';

/**
 * Mode "practicar" (F04-T05): one stage on its own. The session starts in that stage with nothing completed, so
 * the result stays pending whatever happens, and the stage ends where the whole exam would move on.
 */
describe('practising one stage (F04-T05)', () => {
  it('stage I alone ends when the preparation is done, with the stage completed and the result pending', () => {
    const { driver } = cityExam('manual', 1, { practice: 'I' });
    driver.ready();
    driver.recognise();
    driver.prepareProperly();

    expect(driver.phase).toBe('finished');
    expect(driver.session.completedStages).toEqual(['I']);
    expect(driver.faults).toEqual([]);
    expect(resultOf(driver.session.ledger, driver.session.completedStages)).toBe('pending');
    const card = buildCard(driver.session);
    expect(card.verdict).toEqual({ kind: 'pending', points: 0 });
    expect(card.stages.map((stage) => [stage.inScope, stage.completed])).toEqual([
      [true, true],
      [false, false],
      [false, false],
    ]);
  });

  it('stage II alone starts in the box with the engine off and the key in, asking to start the engine', () => {
    const { driver } = cityExam('automatic', 1, { practice: 'II' });

    expect(driver.phase).toBe('unlock');
    expect(driver.session.scope).toEqual({ from: 'II', to: 'II' });
    expect(driver.car.powertrain.engineRunning).toBe(false);
    expect(driver.car.powertrain.key).toBe('on');
    expect(driver.session.completedStages).toEqual([]);
    expect(driver.session.transitions).toEqual([{ phase: 'unlock', atS: 0 }]);
  });

  it('stage III alone starts on leg 8 before the notice, parks cleanly and ends pending with stage III complete', () => {
    const exam = cityExam('automatic', 1, { practice: 'III' });
    const { driver } = exam;
    expect(driver.phase).toBe('circulation');
    expect(driver.session.street.leg).toBe(8);
    expect(driver.session.street.parkingAheadM).toBeNull();
    expect(driver.car.powertrain.engineRunning).toBe(true);
    // Standing still at the start is not an unnecessary stop; the car waits in P with the handbrake on.
    driver.hold({ ...IDLE, brake: 1 }, (_, t) => t > 2);
    expect(driver.faults).toEqual([]);
    driver.drive({ type: 'shift', to: 'D' }, { type: 'handbrake', engaged: false });

    let noticedAtM: number | null = null;
    cruise(exam, {
      until: (item) => {
        const { parkingAheadM } = item.session.street;
        if (noticedAtM === null && parkingAheadM !== null) noticedAtM = parkingAheadM;
        return item.phase === 'parking';
      },
      maxS: 200,
    });
    expect(noticedAtM).not.toBeNull();
    expect(noticedAtM ?? 0).toBeLessThanOrEqual(100);
    expect(noticedAtM ?? 0).toBeGreaterThan(90);
    // Stage II was not driven in this practice: the lap's end does not mark it complete.
    expect(driver.session.completedStages).toEqual([]);
    stopInDoubleFile(exam);
    parkInTheBay(exam);
    descend(driver);

    expect(driver.faults).toEqual([]);
    expect(driver.phase).toBe('finished');
    expect(driver.session.completedStages).toEqual(['III']);
    expect(resultOf(driver.session.ledger, driver.session.completedStages)).toBe('pending');
    const card = buildCard(driver.session);
    expect(card.verdict).toEqual({ kind: 'pending', points: 0 });
    expect(card.stages.map((stage) => [stage.inScope, stage.completed])).toEqual([
      [false, false],
      [false, false],
      [true, true],
    ]);
  }, 120000);
});
