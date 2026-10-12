import { describe, expect, it } from 'vitest';
import { catalogActivities } from '../content/testing/catalogActivities.ts';
import type { Activity } from '../content/schemas.ts';
import { decisionStep, evaluateResponse, nextDistinctSeed, presentActivity } from './engine.ts';
import { createRandom, shuffle } from './random.ts';

const activities = catalogActivities;
function byId<T extends Activity['type']>(id: string, type: T): Extract<Activity, { type: T }> {
  const activity = activities.find((item) => item.id === id);
  if (!activity || activity.type !== type) throw new Error(`missing ${type} ${id}`);
  return activity as Extract<Activity, { type: T }>;
}

describe('nextDistinctSeed', () => {
  it('prefers another variant when the activity has several', () => {
    for (const activity of activities.filter((item) => item.variants.length > 1)) {
      for (let seed = 0; seed < 20; seed += 1) {
        const next = nextDistinctSeed(activity, seed);
        expect(presentActivity(activity, next).variantId, `${activity.id}@${seed}`).not.toBe(
          presentActivity(activity, seed).variantId,
        );
      }
    }
  });

  it('changes at least the order when there is a single variant', () => {
    const single = activities.find((item) => item.variants.length === 1 && item.type === 'ordering') as Activity;
    const current = presentActivity(single, 3);

    const next = presentActivity(single, nextDistinctSeed(single, 3));

    expect({ ...next, seed: 0 }).not.toEqual({ ...current, seed: 0 });
  });

  it('falls back to the next seed when no other presentation exists', () => {
    // One variant with a single option: every seed presents exactly the same question.
    const base = activities.find((item) => item.type === 'single-choice') as Extract<
      Activity,
      { type: 'single-choice' }
    >;
    const variant = base.variants[0]!;
    const constant: Activity = { ...base, variants: [{ ...variant, options: [variant.options[0]!] }] };

    expect(nextDistinctSeed(constant, 41)).toBe(42);
  });
});

describe('random', () => {
  it('repeats the same sequence for the same seed and differs across seeds', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const c = createRandom(43);

    const first = [a(), a(), a()];

    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('shuffles without losing or duplicating items', () => {
    const items = [1, 2, 3, 4, 5, 6];

    const shuffled = shuffle(items, createRandom(7));

    expect([...shuffled].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('presentActivity', () => {
  it('is deterministic for a seed and reaches every variant across seeds', () => {
    const activity = byId('act.max-speed-light-vehicles', 'single-choice');

    const first = presentActivity(activity, 123);
    const again = presentActivity(activity, 123);
    const variants = new Set(Array.from({ length: 64 }, (_, seed) => presentActivity(activity, seed).variantId));

    expect(again).toEqual(first);
    expect(variants).toEqual(new Set(activity.variants.map((variant) => variant.id)));
  });

  it('never exposes which option is correct', () => {
    for (const activity of activities) {
      const presentation = presentActivity(activity, 5);
      expect(JSON.stringify(presentation)).not.toMatch(/"correct"|"outcome"|"reason"|"feedback"/);
    }
  });

  it('includes the sign for sign identification and none for plain choices', () => {
    const sign = presentActivity(byId('act.regulatory-signs', 'sign-identification'), 1);
    const plain = presentActivity(byId('act.turn-signal-distance', 'single-choice'), 1);

    expect(sign.kind === 'choice' && sign.signId).toMatch(/^sign\.regulatory\./);
    expect(plain.kind === 'choice' && plain.signId).toBeNull();
  });

  it('never presents an ordering that is already solved', () => {
    const activity = byId('act.normative-priority-order', 'ordering');

    for (let seed = 0; seed < 200; seed += 1) {
      const presentation = presentActivity(activity, seed);
      if (presentation.kind !== 'ordering') throw new Error('expected ordering');
      const variant = activity.variants.find((item) => item.id === presentation.variantId)!;
      expect(presentation.items.map((item) => item.id)).not.toEqual(variant.items.map((item) => item.id));
    }
  });
});

describe('evaluateResponse', () => {
  it('scores a right and a wrong choice, with feedback, the right answer and sources', () => {
    const activity = byId('act.max-speed-light-vehicles', 'single-choice');

    const right = evaluateResponse(activity, 'street', { kind: 'choice', optionId: '40' });
    const wrong = evaluateResponse(activity, 'street', { kind: 'choice', optionId: '60' });

    expect(right).toMatchObject({ correct: true, score: 1, correctAnswer: '40 km/h' });
    expect(wrong).toMatchObject({ correct: false, score: 0, correctAnswer: '40 km/h' });
    expect(wrong.feedback[0]).toMatch(/^No es esa/);
    expect(wrong.refs).toContainEqual({ source: 'manual', page: 72 });
    expect(wrong.explanation).toMatch(/40 km\/h/);
  });

  it('gives partial credit for orderings and lists the reasons in the right order', () => {
    const activity = byId('act.turn-steps-order', 'ordering');

    const perfect = evaluateResponse(activity, 'right-turn', { kind: 'ordering', order: ['position', 'slow', 'turn'] });
    const swapped = evaluateResponse(activity, 'right-turn', { kind: 'ordering', order: ['slow', 'position', 'turn'] });

    expect(perfect).toMatchObject({ correct: true, score: 1 });
    expect(swapped.correct).toBe(false);
    expect(swapped.score).toBeCloseTo(1 / 3);
    expect(swapped.feedback[0]).toMatch(/^1\. Ubicarme en el carril derecho/);
  });

  it('walks decision paths to their outcome', () => {
    const activity = byId('act.turn-with-pedestrian', 'decision');

    const good = evaluateResponse(activity, 'green-right-turn', { kind: 'decision', choiceIds: ['prepare', 'yield'] });
    const early = evaluateResponse(activity, 'green-right-turn', { kind: 'decision', choiceIds: ['late'] });

    expect(good).toMatchObject({ correct: true, score: 1 });
    expect(early).toMatchObject({ correct: false, score: 0 });
    expect(early.feedback[0]).toMatch(/30 m antes/);
    expect(early.correctAnswer).toMatch(/cediste el paso/);
    expect(decisionStep(activity, 'green-right-turn', 'approach', 'prepare')).toEqual({ next: 'crossing' });
  });

  it('rejects responses the interface could never produce', () => {
    const choice = byId('act.turn-signal-distance', 'single-choice');
    const ordering = byId('act.turn-steps-order', 'ordering');
    const decision = byId('act.turn-with-pedestrian', 'decision');

    expect(() => evaluateResponse(choice, 'signal', { kind: 'choice', optionId: 'zz' })).toThrow(/Unknown option/);
    expect(() => evaluateResponse(choice, 'nope', { kind: 'choice', optionId: 'a' })).toThrow(/Unknown variant/);
    expect(() => evaluateResponse(choice, 'signal', { kind: 'ordering', order: [] })).toThrow(/does not match/);
    expect(() =>
      evaluateResponse(ordering, 'right-turn', { kind: 'ordering', order: ['position', 'position', 'turn'] }),
    ).toThrow(/exactly once/);
    expect(() => evaluateResponse(decision, 'green-right-turn', { kind: 'decision', choiceIds: ['prepare'] })).toThrow(
      /ends before an outcome/,
    );
    expect(() =>
      evaluateResponse(decision, 'green-right-turn', { kind: 'decision', choiceIds: ['late', 'yield'] }),
    ).toThrow(/continues after an outcome/);
    expect(() => decisionStep(decision, 'green-right-turn', 'approach', 'ghost')).toThrow(/Unknown choice/);
  });
});
