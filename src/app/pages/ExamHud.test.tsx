import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { CityLeg } from '../../city/model.ts';
import { aidsOf } from '../../exam/modes.ts';
import type { DrivingMode } from '../../exam/modes.ts';
import { recordFault } from '../../exam/scoring.ts';
import { createSession } from '../../exam/session.ts';
import type { Session } from '../../exam/session.ts';
import type { Street } from '../../exam/street.ts';
import type { Parking } from '../../exam/parking.ts';
import { REAL_BANDS, REAL_RULES } from '../../test/realRules.ts';
import { EXAM_COPY as copy } from '../../i18n/es-AR.ts';
import { ExamHud, LearnPanel, descentText, examinerSays, noticeText } from './ExamHud.tsx';

const LEGS: CityLeg[] = [
  { number: 1, street: 'Quesada', path: [], lengthM: 100, turn: 'right' },
  { number: 2, street: 'Av. Cabildo', path: [], lengthM: 200, turn: 'right' },
];

function session(
  overrides: Partial<Omit<Session, 'street' | 'parking'>> & {
    street?: Partial<Street>;
    parking?: Partial<Parking>;
  } = {},
): Session {
  const base = createSession(REAL_RULES, 'manual', 1, null, REAL_BANDS);
  const { street, parking, ...rest } = overrides;
  return { ...base, ...rest, street: { ...base.street, ...street }, parking: { ...base.parking, ...parking } };
}

function renderHud(current: Session, mode: DrivingMode, transmission: 'manual' | 'automatic' = 'manual') {
  render(<ExamHud session={current} aids={aidsOf(mode)} legs={LEGS} transmission={transmission} />);
  return screen.getByTestId('exam-hud');
}

const reading = (hud: HTMLElement, label: string) => within(hud).getByText(label).nextElementSibling;

describe('examinerSays', () => {
  it('asks for a control by name, with how to engage a gear in each gearbox', () => {
    const asking = (target: string) =>
      session({ phase: 'recognition', prompt: { kind: 'recognise', target } as Session['prompt'] });

    expect(examinerSays(asking('clutch'), 'manual')).toBe(copy.prompts.clutch);
    expect(examinerSays(asking('gear-R'), 'manual')).toBe(`${copy.prompts['gear-R']} ${copy.gearHintManual}`);
    expect(examinerSays(asking('gear-P'), 'automatic')).toBe(`${copy.prompts['gear-P']} ${copy.gearHintAutomatic}`);
    // A gear the copy does not name is read out as its id rather than left blank.
    expect(examinerSays(asking('gear-6'), 'manual')).toBe(`gear-6 ${copy.gearHintManual}`);
  });

  it('adds the technique of the 30 cm and of the first metres for the gearbox in use', () => {
    const saying = (message: Session['phase']) => session({ phase: message, prompt: { kind: 'say', message } });

    expect(examinerSays(saying('reverse'), 'manual')).toBe(`${copy.phases.reverse} ${copy.phases.reverseManual}`);
    expect(examinerSays(saying('forward'), 'automatic')).toBe(`${copy.phases.forward} ${copy.phases.forwardAutomatic}`);
    expect(examinerSays(saying('exit'), 'manual')).toBe(copy.phases.exit);
  });

  it('announces the next turn on the street and the parking 100 m before the bay, only while circulating', () => {
    const instruction = { turn: 'left' as const, street: 'Av. Cabildo' };
    const turn = copy.instruction('left', 'Av. Cabildo');

    expect(
      examinerSays(
        session({ phase: 'firstMetres', prompt: { kind: 'say', message: 'firstMetres' }, street: { instruction } }),
        'manual',
      ),
    ).toBe(`${copy.phases.firstMetres} ${copy.phases.firstMetresManual} ${turn}`);
    expect(
      examinerSays(
        session({
          phase: 'circulation',
          prompt: { kind: 'say', message: 'circulation' },
          street: { instruction, parkingAheadM: 98.6 },
        }),
        'manual',
      ),
    ).toBe(`${copy.phases.circulation} ${turn} ${copy.parkingNotice(98.6)}`);
    expect(
      examinerSays(
        session({
          phase: 'parking',
          prompt: { kind: 'say', message: 'parking' },
          street: { instruction, parkingAheadM: 5 },
        }),
        'manual',
      ),
    ).toBe(copy.phases.parking);
  });
});

describe('noticeText', () => {
  it('reads nothing ahead, a control with its distance, and the light of a signal', () => {
    expect(noticeText(null)).toBe(copy.nothingAhead);
    expect(noticeText({ kind: 'stop', distanceM: 12.2, light: null })).toBe(copy.notices.stop(12.2));
    expect(noticeText({ kind: 'signal', distanceM: 40, light: 'red' })).toBe(
      `${copy.notices.signal(40)} ${copy.lightStates.red}.`,
    );
  });
});

describe('descentText', () => {
  it('lists the steps before opening the door, neutral in the manual and P in the automatic, ticking the mirror', () => {
    const before = session({ phase: 'leaving' });
    const looked = session({ phase: 'leaving', parking: { leftMirrorChecked: true } });

    expect(descentText(before, 'manual')).toMatch(new RegExp(`^${copy.descentSteps.neutral} · `));
    expect(descentText(before, 'automatic')).toMatch(new RegExp(`^${copy.descentSteps.park} · `));
    expect(descentText(before, 'manual')).toMatch(new RegExp(`${copy.descentSteps.mirror}$`));
    expect(descentText(looked, 'manual')).toMatch(new RegExp(`${copy.descentSteps.mirror} ✓$`));
  });
});

describe('ExamHud', () => {
  it('shows every driving aid with pending readings at the start of a run', () => {
    const hud = renderHud(session(), 'run');

    expect(within(hud).getByTestId('exam-points')).toHaveTextContent('0');
    expect(within(hud).getByTestId('exam-leg')).toHaveTextContent(copy.leg(1, 'Quesada'));
    expect(within(hud).getByTestId('exam-instruction')).toHaveTextContent(copy.pendingMeasure);
    expect(within(hud).getByTestId('exam-notice')).toHaveTextContent(copy.nothingAhead);
    expect(within(hud).getByTestId('exam-limits')).toHaveTextContent(copy.pendingMeasure);
    expect(reading(hud, copy.reverseCm)).toHaveTextContent(copy.pendingMeasure);
    expect(reading(hud, copy.firstMetresTopKmh)).toHaveTextContent(copy.pendingMeasure);
    expect(within(hud).getByTestId('exam-light')).toHaveTextContent(copy.noSignalAhead);
    expect(within(hud).getByTestId('exam-parking')).toHaveTextContent(copy.parkingCountersOf(0, 0));
    expect(within(hud).getByTestId('exam-kerb')).toHaveTextContent(copy.pendingMeasure);
    expect(within(hud).queryByTestId('exam-descent')).not.toBeInTheDocument();
  });

  it('writes the measurements, the limits, the light ahead and the next turn as they come', () => {
    const hud = renderHud(
      session({
        phase: 'circulation',
        measurements: { reverseCm: 28.4, forwardCm: 31.6, exitManoeuvres: 1, firstMetresTopKmh: 27.8 },
        street: {
          leg: 2,
          instruction: { turn: 'right', street: 'Manuela Pedraza' },
          notice: { kind: 'signal', distanceM: 35, light: 'yellow' },
          road: { street: 'Av. Cabildo', examKmh: 45, postedKmh: 60 },
        },
      }),
      'practice',
    );

    expect(within(hud).getByTestId('exam-leg')).toHaveTextContent(copy.leg(2, 'Av. Cabildo'));
    expect(within(hud).getByTestId('exam-instruction')).toHaveTextContent(copy.instruction('right', 'Manuela Pedraza'));
    expect(within(hud).getByTestId('exam-notice')).toHaveTextContent(
      `${copy.notices.signal(35)} ${copy.lightStates.yellow}.`,
    );
    expect(within(hud).getByTestId('exam-limits')).toHaveTextContent(copy.limitsOf(45, 60));
    expect(reading(hud, copy.reverseCm)).toHaveTextContent('28 cm');
    expect(reading(hud, copy.forwardCm)).toHaveTextContent('32 cm');
    expect(reading(hud, copy.exitManoeuvres)).toHaveTextContent('1');
    expect(reading(hud, copy.firstMetresTopKmh)).toHaveTextContent('28 km/h');
    expect(within(hud).getByTestId('exam-light')).toHaveTextContent(copy.lightStates.yellow);
  });

  it('shows no light for a control ahead that is not a signal, and no leg for one outside the circuit', () => {
    const hud = renderHud(session({ street: { leg: 9, notice: { kind: 'stop', distanceM: 10, light: null } } }), 'run');

    expect(within(hud).getByTestId('exam-light')).toHaveTextContent(copy.noSignalAhead);
    expect(within(hud).getByTestId('exam-leg')).toHaveTextContent(copy.pendingMeasure);
  });

  it('counts down to the bay while parking, then counts manoeuvres and attempts once it began', () => {
    const { unmount } = render(
      <ExamHud
        session={session({ phase: 'parking', parking: { aheadM: 7.4, startedAtS: null } })}
        aids={aidsOf('run')}
        legs={LEGS}
        transmission="manual"
      />,
    );
    expect(screen.getByTestId('exam-parking')).toHaveTextContent(copy.bayAhead(7.4));
    unmount();

    renderHud(session({ phase: 'parking', parking: { aheadM: 2, startedAtS: 30, manoeuvres: 2, attempts: 1 } }), 'run');
    expect(screen.getByTestId('exam-parking')).toHaveTextContent(copy.parkingCountersOf(2, 1));
  });

  it('gives the live distance to the kerb, then the one measured when the parking was declared done', () => {
    const { unmount } = render(
      <ExamHud
        session={session({ phase: 'parking', parking: { kerb: { frontCm: 22.4, rearCm: 18.6 } } })}
        aids={aidsOf('run')}
        legs={LEGS}
        transmission="manual"
      />,
    );
    expect(screen.getByTestId('exam-kerb')).toHaveTextContent(copy.kerbDistanceOf(22.4, 18.6));
    unmount();

    renderHud(
      session({
        phase: 'leaving',
        parking: { kerb: { frontCm: 40, rearCm: 40 }, final: { frontCm: 20, rearCm: 21, alongM: 0.1 } },
      }),
      'run',
      'automatic',
    );
    expect(screen.getByTestId('exam-kerb')).toHaveTextContent(copy.kerbDistanceOf(20, 21));
    expect(screen.getByTestId('exam-descent')).toHaveTextContent(new RegExp(`^${copy.descentSteps.park} · `));
  });

  it('hides the aids in the exam mode until the end, when the points appear', () => {
    const { unmount } = render(<ExamHud session={session()} aids={aidsOf('exam')} legs={LEGS} transmission="manual" />);
    const hud = screen.getByTestId('exam-hud');
    expect(hud).toHaveAttribute('data-aids', '');
    expect(within(hud).queryByTestId('exam-points')).not.toBeInTheDocument();
    expect(within(hud).queryByTestId('exam-notice')).not.toBeInTheDocument();
    expect(within(hud).getByTestId('exam-leg')).toBeInTheDocument();
    unmount();

    renderHud(session({ phase: 'finished' }), 'exam');
    expect(screen.getByTestId('exam-points')).toHaveTextContent('0');
  });
});

describe('LearnPanel', () => {
  it('tells what the phase checks and explains the last fault as it happens', () => {
    const clean = session({ phase: 'preparation' });
    const { unmount } = render(<LearnPanel session={clean} />);
    expect(screen.getByTestId('exam-hints')).toHaveTextContent(copy.learnHints.preparation.checks);
    expect(screen.queryByTestId('exam-last-fault')).not.toBeInTheDocument();
    unmount();

    const ledger = recordFault(clean.ledger, { ruleId: 'rule.minor.c-seat-adjustment', stage: 'I', atS: 3 });
    render(
      <MemoryRouter>
        <LearnPanel session={{ ...clean, ledger }} />
      </MemoryRouter>,
    );
    const last = screen.getByTestId('exam-last-fault');
    expect(last).toHaveTextContent(copy.lastFault);
    expect(last).toHaveTextContent(copy.faultPoints(1));
    expect(within(last).getAllByRole('link')[0]).toHaveAttribute('href', '/biblioteca/protocolo/9');
  });

  it('does not explain a fault whose rule the session does not know', () => {
    const base = session({ phase: 'recognition' });
    const ledger = recordFault(base.ledger, { ruleId: 'rule.minor.c-seat-adjustment', stage: 'I', atS: 3 });

    render(<LearnPanel session={{ ...base, ledger, rules: [] }} />);

    expect(screen.getByTestId('exam-hints')).toHaveTextContent(copy.learnHints.recognition.checks);
    expect(screen.queryByTestId('exam-last-fault')).not.toBeInTheDocument();
  });
});
