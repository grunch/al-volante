import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Presentation } from '../engine.ts';
import { ACTIVITY_COPY } from '../../i18n/es-AR.ts';

type ChoicePresentation = Extract<Presentation, { kind: 'choice' }>;

/** One question with radio options; locked once answered. */
export function ChoiceQuestion({
  presentation,
  answered,
  onAnswer,
}: {
  presentation: ChoicePresentation;
  answered: boolean;
  onAnswer: (optionId: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selected) onAnswer(selected);
  };
  return (
    <form onSubmit={submit}>
      <fieldset disabled={answered} className="question">
        <legend className="question__prompt">{presentation.prompt}</legend>
        {presentation.options.map((option) => (
          <label key={option.id} className="option">
            <input
              type="radio"
              name="option"
              value={option.id}
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </fieldset>
      {!answered && (
        <button type="submit" className="button" disabled={selected === null}>
          {ACTIVITY_COPY.answer}
        </button>
      )}
    </form>
  );
}
