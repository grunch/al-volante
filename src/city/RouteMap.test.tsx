import { render, screen } from '@testing-library/react';
import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { CITY_COPY } from '../i18n/es-AR.ts';
import { buildCity } from './model.ts';
import { RouteMap } from './RouteMap.tsx';

const city = buildCity(RouteSchema.parse(routeData));

describe('route map', () => {
  it('is an accessible north-up map with every leg numbered at its start and the selected one emphasised', () => {
    // Act
    const { container } = render(<RouteMap city={city} selected={3} />);

    // Assert
    expect(screen.getByRole('img', { name: CITY_COPY.mapLabel })).toBeInTheDocument();
    const legs = [...container.querySelectorAll('polyline')];
    expect(legs).toHaveLength(city.legs.length);
    city.legs.forEach((leg, index) => {
      const line = legs[index]!;
      expect(line.getAttribute('points')).toBe(leg.path.map((point) => `${point.x},${point.z}`).join(' '));
      expect(line.getAttribute('stroke-width')).toBe(leg.number === 3 ? '8' : '4');
      const marker = container.querySelectorAll('circle')[index]!;
      expect(marker.getAttribute('cx')).toBe(String(leg.path[0]!.x));
      expect(marker.getAttribute('cy')).toBe(String(leg.path[0]!.z));
    });
    expect([...container.querySelectorAll('text')].map((text) => text.textContent)).toEqual([
      ...city.legs.map((leg) => String(leg.number)),
      CITY_COPY.north,
      CITY_COPY.mapScale,
    ]);
    // Only context streets are drawn underneath; the route's own streets are the legs.
    const context = city.roads.filter((road) => road.kind === 'context');
    expect(container.querySelectorAll('path[stroke-width="7"]')).toHaveLength(context.length);
  });
});
