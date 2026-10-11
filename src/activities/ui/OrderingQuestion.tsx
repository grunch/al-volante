import { useState } from 'react';
import type { Presentation } from '../engine.ts';
import { ACTIVITY_COPY } from '../../i18n/es-AR.ts';

type OrderingPresentation = Extract<Presentation, { kind: 'ordering' }>;

/** Keyboard-friendly ordering: each item moves up or down with buttons instead of drag and drop. */
export function OrderingQuestion({
  presentation,
  answered,
  onAnswer,
}: {
  presentation: OrderingPresentation;
  answered: boolean;
  onAnswer: (order: string[]) => void;
}) {
  const [items, setItems] = useState(presentation.items);
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target] as (typeof items)[number], next[index] as (typeof items)[number]];
    setItems(next);
  };
  return (
    <div className="question">
      <p className="question__prompt" id="ordering-prompt">
        {presentation.prompt}
      </p>
      <ol className="ordering" aria-labelledby="ordering-prompt">
        {items.map((item, index) => (
          <li key={item.id} className="ordering__item">
            <span>{item.text}</span>
            {!answered && (
              <span className="ordering__controls">
                <button
                  type="button"
                  className="button button--small"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`${ACTIVITY_COPY.moveUp}: ${item.text}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="button button--small"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`${ACTIVITY_COPY.moveDown}: ${item.text}`}
                >
                  ↓
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!answered && (
        <button type="button" className="button" onClick={() => onAnswer(items.map((item) => item.id))}>
          {ACTIVITY_COPY.check}
        </button>
      )}
    </div>
  );
}
