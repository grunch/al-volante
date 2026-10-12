import { describe, expect, it } from 'vitest';
import type { Activity } from './schemas.ts';
import { catalogActivities } from './testing/catalogActivities.ts';

// Content policy of CONTENIDO.md, checked over the shipped catalog: no answer settles an open discrepancy and no
// activity asks for (or shows) data the project decided not to evaluate.

type DecisionVariant = Extract<Activity, { type: 'decision' }>['variants'][number];

/** A rewarded answer with the question it answers: right options, ordering items and choices to correct outcomes. */
interface RightAnswer {
  question: string;
  answer: string;
}

function rightAnswers(activity: Activity): RightAnswer[] {
  return activity.variants.flatMap((variant): RightAnswer[] => {
    if (activity.type === 'single-choice' || activity.type === 'sign-identification') {
      const { prompt, options } = variant as (typeof activity.variants)[number];
      return options.filter((option) => option.correct).map((option) => ({ question: prompt, answer: option.text }));
    }
    if (activity.type === 'ordering') {
      const { prompt, items } = variant as (typeof activity.variants)[number];
      return items.map((item) => ({ question: prompt, answer: item.text }));
    }
    const { nodes, outcomes } = variant as DecisionVariant;
    const correct = new Set(Object.keys(outcomes).filter((id) => outcomes[id]?.correct));
    return Object.values(nodes).flatMap((node) =>
      node.choices
        .filter((choice) => choice.outcome !== undefined && correct.has(choice.outcome))
        .map((choice) => ({ question: node.text, answer: choice.text })),
    );
  });
}

const PEDESTRIAN_STREETS = /convivencia|prioridad peat|peatonal/i;

/** Open discrepancies (CONTENIDO.md) that no right answer may settle, with the decision that keeps them out. */
const UNSETTLED: Array<{ decision: string; settles: (right: RightAnswer) => boolean }> = [
  {
    // 10 km/h (ficha) vs 20 km/h (note 5) on pedestrian-priority and shared streets (manual PDF 26).
    decision: 'D-T01-1',
    settles: ({ question, answer }) =>
      /\b(10|20)\s?km\/h\b/i.test(answer) && PEDESTRIAN_STREETS.test(`${question} ${answer}`),
  },
  // The 911 no longer centralises calls for the Federal Police in CABA.
  { decision: 'D-T01-4', settles: ({ answer }) => /polic[ií]a federal/i.test(answer) },
  // VTV deadlines and frequency are changing.
  {
    decision: 'D-T01-12',
    settles: ({ question, answer }) =>
      /VTV|verificaci[oó]n t[eé]cnica/i.test(`${question} ${answer}`) && /\b\d+\s?(años?|meses|km)\b/i.test(answer),
  },
  // Cordón amarillo (manual PDF 60 vs 196): both say no parking; whether one may stop, or all day, is unsettled.
  {
    decision: 'D-T02-1',
    settles: ({ question, answer }) =>
      /cord[oó]n amarillo/i.test(`${question} ${answer}`) && /deten|24\s?h/i.test(answer),
  },
  // The general alcohol limits (PDF 91) are not evaluated (F05-T03).
  { decision: 'alcohol general', settles: ({ answer }) => /0[,.]5\s?g/i.test(answer) },
];

describe('catalog content policy', () => {
  it('never rewards an answer that settles an open discrepancy', () => {
    for (const activity of catalogActivities) {
      for (const right of rightAnswers(activity)) {
        for (const { decision, settles } of UNSETTLED)
          expect(settles(right), `${activity.id}: "${right.answer}" settles ${decision}`).toBe(false);
      }
    }
  });

  it('flags answers that would settle a discrepancy', () => {
    const settlesAny = (question: string, answer: string) =>
      UNSETTLED.filter(({ settles }) => settles({ question, answer })).map(({ decision }) => decision);

    expect(settlesAny('¿Velocidad máxima en una calle de convivencia?', '20 km/h')).toEqual(['D-T01-1']);
    expect(settlesAny('¿Velocidad máxima en un pasaje?', '20 km/h')).toEqual([]);
    expect(settlesAny('¿Cuándo vence la VTV?', 'A los 4 años')).toEqual(['D-T01-12']);
    expect(settlesAny('¿Qué indica el cordón amarillo?', 'Se puede detener, pero no estacionar')).toEqual(['D-T02-1']);
    expect(settlesAny('¿Qué indica el cordón amarillo?', 'Prohíbe estacionar')).toEqual([]);
  });

  it('shows no web addresses or e-mails: contact data is consultation material', () => {
    for (const activity of catalogActivities) {
      expect(JSON.stringify(activity), activity.id).not.toMatch(/https?:\/\/|www\.|\.gob\.ar|\.org\b|@[a-z0-9-]+\./i);
    }
  });
});
