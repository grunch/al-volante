import { useMemo } from 'react';
import { DrivingCanvas } from '../practice/DrivingCanvas.tsx';
import type { RendererFactory } from '../scene/SceneCanvas.tsx';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import type { City } from './model.ts';
import { entryPose } from './model.ts';
import { cityCockpitFactory } from './scene.ts';
import { createCityRenderer } from './lighting.ts';
import { createTrafficSource } from '../traffic/traffic.ts';
import { CITY_COPY as copy } from '../i18n/es-AR.ts';

export function CityDrive({
  city,
  leg,
  transmission,
  resetCount,
  seed,
  createRenderer = createCityRenderer,
}: {
  city: City;
  leg: number;
  transmission: TransmissionKind;
  resetCount: number;
  /** Seed of the traffic scenario; the same seed replays the same traffic (F04-T02). */
  seed: number;
  createRenderer?: RendererFactory;
}) {
  const createScene = useMemo(() => cityCockpitFactory(city), [city]);
  const start = useMemo(() => entryPose(city, leg), [city, leg]);
  const world = useMemo(() => ({ ...city.world, traffic: createTrafficSource(city, seed) }), [city, seed]);
  return (
    <DrivingCanvas
      world={world}
      start={start}
      transmission={transmission}
      resetCount={resetCount}
      createScene={createScene}
      createRenderer={createRenderer}
      label={copy.canvasLabel}
      subtitle={copy.drivingSubtitle}
      loadingText={copy.loading}
      unavailableText={copy.unavailable}
    />
  );
}
