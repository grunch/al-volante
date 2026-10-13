import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Presentation } from '../engine.ts';
import { ACTIVITY_COPY } from '../../i18n/es-AR.ts';
import { OrderingQuestion } from './OrderingQuestion.tsx';

type OrderingPresentation = Extract<Presentation, { kind: 'ordering' }>;

const presentation: OrderingPresentation = {
  kind: 'ordering',
  activityId: 'act.order',
  variantId: 'v1',
  seed: 0,
  prompt: 'Ordená los pasos',
  items: [
    { id: 'mirror', text: 'Mirar el espejo' },
    { id: 'signal', text: 'Poner la luz de giro' },
    { id: 'turn', text: 'Doblar' },
  ],
};

const up = (text: string) => screen.getByRole('button', { name: `${ACTIVITY_COPY.moveUp}: ${text}` });
const down = (text: string) => screen.getByRole('button', { name: `${ACTIVITY_COPY.moveDown}: ${text}` });
const order = () => screen.getAllByRole('listitem').map((item) => item.firstChild?.textContent);

function renderQuestion(answered = false) {
  const onAnswer = vi.fn();
  render(<OrderingQuestion presentation={presentation} answered={answered} onAnswer={onAnswer} />);
  return { onAnswer, user: userEvent.setup() };
}

describe('OrderingQuestion', () => {
  it('moves items with the keyboard and answers with the order shown', async () => {
    // Arrange
    const { user, onAnswer } = renderQuestion();

    // Act
    down('Mirar el espejo').focus();
    await user.keyboard('{Enter}');
    up('Doblar').focus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: ACTIVITY_COPY.check }));

    // Assert
    expect(order()).toEqual(['Poner la luz de giro', 'Doblar', 'Mirar el espejo']);
    expect(onAnswer).toHaveBeenCalledWith(['signal', 'turn', 'mirror']);
  });

  it('keeps the focus on the moved item, so the next key press moves it again', async () => {
    const { user } = renderQuestion();

    down('Mirar el espejo').focus();
    await user.keyboard('{Enter}');

    expect(down('Mirar el espejo')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(order()).toEqual(['Poner la luz de giro', 'Doblar', 'Mirar el espejo']);
  });

  it('moves the focus to the other button of the item when it reaches an end, instead of losing it', async () => {
    // Arrange
    const { user } = renderQuestion();

    // Act: to the bottom, then all the way back to the top.
    down('Poner la luz de giro').focus();
    await user.keyboard('{Enter}');
    const atBottom = document.activeElement;
    await user.keyboard('{Enter}{Enter}');

    // Assert
    expect(atBottom).toBe(up('Poner la luz de giro'));
    expect(order()).toEqual(['Poner la luz de giro', 'Mirar el espejo', 'Doblar']);
    expect(down('Poner la luz de giro')).toHaveFocus();
  });

  it('shows the order without controls once answered', () => {
    renderQuestion(true);

    expect(order()).toEqual(['Mirar el espejo', 'Poner la luz de giro', 'Doblar']);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
