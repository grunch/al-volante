import { render } from '@testing-library/react';
import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { CITY_COPY } from '../i18n/es-AR.ts';
import { DrivingCanvas } from '../practice/DrivingCanvas.tsx';
import { createFakeRenderer } from '../test/fakeRenderer.ts';
import type { TrafficState } from '../traffic/traffic.ts';
import type { TrafficSource } from '../sim/scenario.ts';
import type { Traffic } from '../traffic/traffic.ts';
import { CityDrive } from './CityDrive.tsx';
import { buildCity, entryPose } from './model.ts';

vi.mock('../practice/DrivingCanvas.tsx', () => ({ DrivingCanvas: vi.fn(() => null) }));

const city = buildCity(RouteSchema.parse(routeData));
const lastProps = () => vi.mocked(DrivingCanvas).mock.calls.at(-1)![0];
const trafficOf = (props: ReturnType<typeof lastProps>) =>
  (props.world.traffic as TrafficSource<TrafficState> & { traffic: Traffic }).traffic;

afterEach(() => vi.mocked(DrivingCanvas).mockClear());

describe('city drive', () => {
  it('drives the city from the entry of the chosen leg, with traffic seeded by the given seed', () => {
    // Arrange
    const createRenderer = () => createFakeRenderer();

    // Act
    render(
      <CityDrive city={city} leg={2} transmission="manual" resetCount={3} seed={7} createRenderer={createRenderer} />,
    );

    // Assert
    const props = lastProps();
    expect(props.start).toEqual(entryPose(city, 2));
    expect(props.world.obstacles).toBe(city.world.obstacles);
    expect(trafficOf(props).seed).toBe(7);
    expect(props).toMatchObject({
      transmission: 'manual',
      resetCount: 3,
      createRenderer,
      label: CITY_COPY.canvasLabel,
      subtitle: CITY_COPY.drivingSubtitle,
      loadingText: CITY_COPY.loading,
      unavailableText: CITY_COPY.unavailable,
    });
  });

  it('keeps the traffic and the scene across renders, and reseeds the traffic only for a new seed', () => {
    // Arrange
    const view = render(<CityDrive city={city} leg={1} transmission="automatic" resetCount={0} seed={1} />);
    const first = lastProps();

    // Act
    view.rerender(<CityDrive city={city} leg={1} transmission="automatic" resetCount={1} seed={1} />);
    const reset = lastProps();
    view.rerender(<CityDrive city={city} leg={1} transmission="automatic" resetCount={1} seed={2} />);
    const reseeded = lastProps();

    // Assert: a reset alone must not rebuild the world (the drive restarts with the same traffic).
    expect(reset.world).toBe(first.world);
    expect(reset.createScene).toBe(first.createScene);
    expect(reseeded.world).not.toBe(first.world);
    expect(trafficOf(reseeded).seed).toBe(2);
    expect(reseeded.createScene).toBe(first.createScene);
    expect(first.start).toBe(city.start.pose);
  });
});
