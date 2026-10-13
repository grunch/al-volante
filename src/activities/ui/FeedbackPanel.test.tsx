import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Evaluation } from '../engine.ts';
import { ACTIVITY_COPY } from '../../i18n/es-AR.ts';
import { FeedbackPanel } from './FeedbackPanel.tsx';

function evaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    activityId: 'act.order',
    variantId: 'v1',
    correct: false,
    score: 0,
    feedback: ['No: primero se mira el espejo.'],
    correctAnswer: 'Mirar → Señalizar → Doblar',
    explanation: 'El manual fija el orden.',
    refs: [
      { source: 'manual', page: 51 },
      { source: 'siniestros', page: 3 },
    ],
    ...overrides,
  };
}

function renderPanel(value: Evaluation, figures: Parameters<typeof FeedbackPanel>[0]['figures'] = undefined) {
  return render(
    <MemoryRouter>
      <FeedbackPanel evaluation={value} {...(figures ? { figures } : {})} />
    </MemoryRouter>,
  );
}

describe('FeedbackPanel', () => {
  it('says a wrong answer in words, with the right answer, the explanation and links to the cited pages', () => {
    renderPanel(evaluation());

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(ACTIVITY_COPY.incorrect);
    expect(screen.getByText('No: primero se mira el espejo.')).toBeInTheDocument();
    expect(screen.getByText('Mirar → Señalizar → Doblar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manual, PDF 51' })).toHaveAttribute('href', '/biblioteca/manual/51');
    expect(screen.getByRole('link', { name: 'Guía de siniestros, PDF 3' })).toHaveAttribute(
      'href',
      '/biblioteca/siniestros/3',
    );
  });

  it('shows partial credit as a percentage and still gives the right answer', () => {
    renderPanel(evaluation({ score: 2 / 3 }));

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      `${ACTIVITY_COPY.partial} (${ACTIVITY_COPY.scoreLabel}: 67 %)`,
    );
    expect(screen.getByText(`${ACTIVITY_COPY.correctAnswer}:`)).toBeInTheDocument();
  });

  it('confirms a right answer without repeating it, and shows the source figures only now', () => {
    renderPanel(evaluation({ correct: true, score: 1, feedback: ['Bien.'] }), [
      {
        id: 'fig.manual-p51-turn',
        source: 'manual',
        page: 51,
        box: { x: 0, y: 0, width: 1, height: 1 },
        alt: 'Esquema de un giro a la derecha',
        unitIds: ['manual.ch3.turn'],
      },
    ]);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(ACTIVITY_COPY.correct);
    expect(screen.queryByText(`${ACTIVITY_COPY.correctAnswer}:`)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Esquema de un giro a la derecha' })).toBeInTheDocument();
  });
});
