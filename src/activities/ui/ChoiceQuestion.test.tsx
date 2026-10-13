import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Presentation } from '../engine.ts';
import { ACTIVITY_COPY } from '../../i18n/es-AR.ts';
import { ChoiceQuestion } from './ChoiceQuestion.tsx';

const presentation: Extract<Presentation, { kind: 'choice' }> = {
  kind: 'choice',
  activityId: 'act.speed',
  variantId: 'v1',
  seed: 0,
  prompt: '¿Velocidad máxima en calles?',
  signId: null,
  options: [
    { id: 'a', text: '40 km/h' },
    { id: 'b', text: '60 km/h' },
    { id: 'c', text: '20 km/h' },
  ],
};

function renderQuestion(answered = false) {
  const onAnswer = vi.fn();
  const view = render(<ChoiceQuestion presentation={presentation} answered={answered} onAnswer={onAnswer} />);
  return { ...view, onAnswer, user: userEvent.setup() };
}

describe('ChoiceQuestion', () => {
  it('answers with the option chosen, once one is chosen', async () => {
    // Arrange
    const { user, onAnswer } = renderQuestion();
    const submit = screen.getByRole('button', { name: ACTIVITY_COPY.answer });
    expect(submit).toBeDisabled();

    // Act
    await user.click(screen.getByRole('radio', { name: '60 km/h' }));
    await user.click(submit);

    // Assert
    expect(onAnswer).toHaveBeenCalledWith('b');
  });

  it('does not answer a submission without a choice', () => {
    const { container, onAnswer } = renderQuestion();

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('locks the options once answered', () => {
    renderQuestion(true);

    expect(screen.getByRole('group', { name: presentation.prompt })).toBeDisabled();
    expect(screen.queryByRole('button', { name: ACTIVITY_COPY.answer })).not.toBeInTheDocument();
  });
});
