import { useMemo } from 'react';
import { DrivingCanvas } from '../practice/DrivingCanvas.tsx';
import type { RendererFactory } from '../scene/SceneCanvas.tsx';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import type { City } from './model.ts';
import { entryPose } from './model.ts';
import { cityCockpitFactory } from './scene.ts';
import { CITY_COPY as copy } from '../i18n/es-AR.ts';

export function CityDrive({
  city,
  leg,
  transmission,
  resetCount,
  createRenderer,
}: {
  city: City;
  leg: number;
  transmission: TransmissionKind;
  resetCount: number;
  createRenderer?: RendererFactory;
}) {
  const createScene = useMemo(() => cityCockpitFactory(city), [city]);
  const start = useMemo(() => entryPose(city, leg), [city, leg]);
  return (
    <DrivingCanvas
      world={city.world}
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
