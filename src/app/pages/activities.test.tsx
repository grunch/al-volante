import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import activitiesJson from '../../../specs/catalog/activities.json';
import { App } from '../App.tsx';
import { routes } from '../routes.tsx';
import { ActivityResultContext } from '../../activities/ActivityResultContext.ts';
import type { ActivityResult, SaveOutcome } from '../../activities/ActivityResultContext.ts';
import { presentActivity } from '../../activities/engine.ts';
import { SignGraphic, hasSignDrawing } from '../../activities/ui/SignGraphic.tsx';
import { loadContent } from '../../content/catalog.ts';
import { ActivityCatalogSchema } from '../../content/schemas.ts';
import type { Activity } from '../../content/schemas.ts';
import { createFakeRenderer } from '../../test/fakeRenderer.ts';
import { ACTIVITY_COPY } from '../../i18n/es-AR.ts';

const activities = ActivityCatalogSchema.parse(activitiesJson);
const find = (id: string) => activities.find((activity) => activity.id === id) as Activity;

function renderWithRealContent(
  path: string,
  record: (result: ActivityResult) => Promise<SaveOutcome> = async () => 'not-recorded',
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ActivityResultContext.Provider value={record}>
      <App router={router} createRenderer={createFakeRenderer} loadContent={loadContent} />
    </ActivityResultContext.Provider>,
  );
  return router;
}

describe('activities list', () => {
  it('lists the sample activities with their type and sources, and says it is a sample', async () => {
    renderWithRealContent('/actividades');

    expect(await screen.findByRole('link', { name: 'Velocidades máximas en CABA' })).toHaveAttribute(
      'href',
      '/actividad/act.max-speed-light-vehicles',
    );
    expect(within(screen.getByRole('main')).getAllByRole('listitem')).toHaveLength(activities.length);
    expect(screen.getByText(/muestra inicial/)).toBeInTheDocument();
  });
});

describe('playing an activity', () => {
  it('answers a choice correctly, shows sources and reports the result', async () => {
    // Arrange
    const user = userEvent.setup();
    const record = vi.fn(async (): Promise<SaveOutcome> => 'saved');
    const activity = find('act.max-speed-light-vehicles');
    const presentation = presentActivity(activity, 3);
    const variant = (activity as Extract<Activity, { type: 'single-choice' }>).variants.find(
      (item) => item.id === presentation.variantId,
    )!;
    const right = variant.options.find((option) => option.correct)!;
    renderWithRealContent('/actividad/act.max-speed-light-vehicles?semilla=3', record);

    // Act
    await user.click(await screen.findByRole('radio', { name: right.text }));
    await user.click(screen.getByRole('button', { name: ACTIVITY_COPY.answer }));

    // Assert
    expect(screen.getByRole('heading', { name: ACTIVITY_COPY.correct })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manual, PDF 72' })).toHaveAttribute('href', '/biblioteca/manual/72');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ evaluation: expect.objectContaining({ correct: true, variantId: variant.id }) }),
    );
    expect(screen.queryByRole('button', { name: ACTIVITY_COPY.answer })).not.toBeInTheDocument();
  });

  it('explains a wrong choice and shows the right answer', async () => {
    const user = userEvent.setup();
    const activity = find('act.turn-signal-distance') as Extract<Activity, { type: 'single-choice' }>;
    const presentation = presentActivity(activity, 8);
    const variant = activity.variants.find((item) => item.id === presentation.variantId)!;
    const wrong = variant.options.find((option) => !option.correct)!;
    renderWithRealContent('/actividad/act.turn-signal-distance?semilla=8');

    await user.click(await screen.findByRole('radio', { name: wrong.text }));
    await user.click(screen.getByRole('button', { name: ACTIVITY_COPY.answer }));

    expect(screen.getByRole('heading', { name: ACTIVITY_COPY.incorrect })).toBeInTheDocument();
    expect(screen.getByText(wrong.feedback)).toBeInTheDocument();
    expect(screen.getByText(`${ACTIVITY_COPY.correctAnswer}:`).parentElement).toHaveTextContent(
      variant.options.find((option) => option.correct)!.text,
    );
  });

  it('draws the sign to identify with an accessible description', async () => {
    renderWithRealContent('/actividad/act.regulatory-signs?semilla=1');

    expect(
      await screen.findByRole('img', { name: new RegExp(`^${ACTIVITY_COPY.signToIdentify}: `) }),
    ).toBeInTheDocument();
  });

  it('orders items with the move buttons and checks the order', async () => {
    const user = userEvent.setup();
    renderWithRealContent('/actividad/act.turn-steps-order?semilla=0');
    await screen.findByRole('button', { name: ACTIVITY_COPY.check });

    // Bubble each expected item to its place using only the buttons.
    for (const [target, text] of [
      'Ubicarme en el carril derecho y encender la luz de giro, 30 m antes',
      'Reducir la velocidad paulatinamente',
    ].entries()) {
      const list = screen.getByRole('list', { name: 'Vas a doblar a la derecha. Ordená los pasos:' });
      let index = within(list)
        .getAllByRole('listitem')
        .findIndex((item) => item.textContent?.startsWith(text));
      while (index > target) {
        await user.click(screen.getByRole('button', { name: `${ACTIVITY_COPY.moveUp}: ${text}` }));
        index -= 1;
      }
    }
    await user.click(screen.getByRole('button', { name: ACTIVITY_COPY.check }));

    expect(screen.getByRole('heading', { name: ACTIVITY_COPY.correct })).toBeInTheDocument();
  });

  it('walks a decision scene to its outcome', async () => {
    const user = userEvent.setup();
    renderWithRealContent('/actividad/act.turn-with-pedestrian?semilla=0');

    await user.click(await screen.findByRole('button', { name: /30 m antes enciendo la luz de giro/ }));
    expect(screen.getByText(/una persona comienza a cruzar/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Paso primero: tengo verde' }));

    expect(screen.getByRole('heading', { name: ACTIVITY_COPY.incorrect })).toBeInTheDocument();
    expect(screen.getByText(/también hay que ceder el paso/)).toBeInTheDocument();
  });

  it('offers a really different variant and moves focus to the title', async () => {
    // Arrange: seeds 10 and 11 give the same presentation of this activity.
    const user = userEvent.setup();
    const activity = find('act.emergency-vehicle');
    expect(presentActivity(activity, 11)).toEqual({ ...presentActivity(activity, 10), seed: 11 });
    const router = renderWithRealContent('/actividad/act.emergency-vehicle?semilla=10');

    // Act
    const choices = await screen.findAllByRole('button', { name: /./ });
    await user.click(choices.find((button) => button.className.includes('button--choice'))!);
    await user.click(screen.getByRole('button', { name: ACTIVITY_COPY.anotherVariant }));

    // Assert
    const next = Number(new URLSearchParams(router.state.location.search).get('semilla'));
    expect(presentActivity(activity, next).variantId).not.toBe(presentActivity(activity, 10).variantId);
    expect(screen.getByRole('heading', { level: 1, name: activity.title })).toHaveFocus();
  });

  it('keeps focus on the activity title while it adds the missing seed', async () => {
    const user = userEvent.setup();
    const router = renderWithRealContent('/actividades');

    await user.click(await screen.findByRole('link', { name: 'Velocidades máximas en CABA' }));
    await waitFor(() => expect(router.state.location.search).toMatch(/^\?semilla=\d+$/));

    expect(screen.getByRole('heading', { level: 1, name: 'Velocidades máximas en CABA' })).toHaveFocus();
  });

  it('adds a reproducible seed to the URL when it is missing', async () => {
    const router = renderWithRealContent('/actividad/act.traffic-light-meaning');

    await waitFor(() => expect(router.state.location.search).toMatch(/^\?semilla=\d+$/));
    expect((await screen.findAllByRole('radio')).length).toBeGreaterThan(1);
  });

  it('replaces a malformed seed with a valid one', async () => {
    const router = renderWithRealContent('/actividad/act.traffic-light-meaning?semilla=abc');

    await waitFor(() => expect(router.state.location.search).toMatch(/^\?semilla=\d+$/));
  });

  it('shows not found for an unknown activity', async () => {
    renderWithRealContent('/actividad/act.nope?semilla=1');

    expect(await screen.findByRole('heading', { level: 1, name: 'No encontramos esa página' })).toBeInTheDocument();
  });
});

describe('sign drawings', () => {
  it('exist for every sign used by an identification activity', () => {
    const used = activities.flatMap((activity) =>
      activity.type === 'sign-identification' ? activity.variants.map((variant) => variant.signId) : [],
    );

    expect(used.length).toBeGreaterThan(0);
    for (const signId of used) expect(hasSignDrawing(signId), signId).toBe(true);
  });

  it('show the legend their catalog description quotes, so sighted players see what screen readers announce', async () => {
    const { signs } = await loadContent().then((result) => {
      if (!result.ok) throw new Error(result.errors.join('\n'));
      return result.content;
    });
    const used = new Set(
      activities.flatMap((activity) =>
        activity.type === 'sign-identification' ? activity.variants.map((variant) => variant.signId) : [],
      ),
    );

    for (const sign of signs.filter((item) => used.has(item.id))) {
      const legend = /"([^"]+)"/.exec(sign.visual)?.[1];
      if (!legend) continue;
      const { container, unmount } = render(<SignGraphic signId={sign.id} description={sign.visual} />);
      // Each SVG line (text or tspan) is a separate element; join them as the reader sees them.
      const lines = [...container.querySelectorAll('text, tspan')].filter((element) => element.children.length === 0);
      expect(lines.map((line) => line.textContent?.trim()).join(' '), sign.id).toBe(legend);
      unmount();
    }
  });

  it('falls back to the written description for signs without a drawing', () => {
    render(<SignGraphic signId="sign.unknown" description="Rombo amarillo con una vaca" />);

    expect(screen.getByRole('img', { name: 'Rombo amarillo con una vaca' })).toHaveTextContent(
      'Rombo amarillo con una vaca',
    );
  });
});
