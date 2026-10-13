import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Presentation } from '../engine.ts';
import { DecisionQuestion } from './DecisionQuestion.tsx';

type DecisionPresentation = Extract<Presentation, { kind: 'decision' }>;

const presentation: DecisionPresentation = {
  kind: 'decision',
  activityId: 'act.turn',
  variantId: 'v1',
  seed: 0,
  start: 'approach',
  nodes: {
    approach: {
      text: 'Te acercás a la esquina.',
      choices: [
        { id: 'signal', text: 'Pongo la luz de giro' },
        { id: 'rush', text: 'Doblo rápido' },
      ],
    },
    crossing: {
      text: 'Un peatón cruza.',
      choices: [
        { id: 'yield', text: 'Le cedo el paso' },
        { id: 'go', text: 'Paso primero' },
      ],
    },
  },
};

/** The scene graph: `signal` opens the crossing, every other choice ends the scene. */
const resolve = (_nodeId: string, choiceId: string) => (choiceId === 'signal' ? 'crossing' : null);

function renderScene(answered = false) {
  const onAnswer = vi.fn();
  const view = render(
    <DecisionQuestion presentation={presentation} answered={answered} resolve={resolve} onAnswer={onAnswer} />,
  );
  return { ...view, onAnswer, user: userEvent.setup() };
}

describe('DecisionQuestion', () => {
  it('walks the scene, keeps the history of each step and answers with the path taken', async () => {
    // Arrange
    const { user, onAnswer } = renderScene();

    // Act
    await user.click(screen.getByRole('button', { name: 'Pongo la luz de giro' }));
    await user.click(screen.getByRole('button', { name: 'Le cedo el paso' }));

    // Assert
    expect(screen.getByText('Te acercás a la esquina.')).toHaveTextContent('→ Pongo la luz de giro');
    expect(onAnswer).toHaveBeenCalledWith(['signal', 'yield']);
  });

  it('takes the keyboard to the new situation after each choice instead of dropping the focus', async () => {
    const { user } = renderScene();

    screen.getByRole('button', { name: 'Pongo la luz de giro' }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByText('Un peatón cruza.')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Le cedo el paso' })).toHaveFocus();
  });

  it('ends at once on a choice that closes the scene', async () => {
    const { user, onAnswer } = renderScene();

    await user.click(screen.getByRole('button', { name: 'Doblo rápido' }));

    expect(onAnswer).toHaveBeenCalledWith(['rush']);
  });

  it('shows no choices once answered', () => {
    renderScene(true);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
