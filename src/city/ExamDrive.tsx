import { useMemo } from 'react';
import type { Observation } from '../exam/session.ts';
import type { Bindings } from '../practice/bindings.ts';
import { DrivingCanvas } from '../practice/DrivingCanvas.tsx';
import type { Telemetry } from '../practice/telemetry.ts';
import type { RendererFactory } from '../scene/SceneCanvas.tsx';
import type { PowertrainCommand, TransmissionKind } from '../sim/powertrain/powertrain.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import type { World } from '../sim/world.ts';
import type { City } from './model.ts';
import { cityCockpitFactory } from './scene.ts';
import { createCityRenderer } from './lighting.ts';
import { EXAM_COPY as copy } from '../i18n/es-AR.ts';

/** The exam's cockpit view on the city (F04-T03): the city scene with the seeded traffic, driven from the box. */
export function ExamDrive({
  city,
  world,
  transmission,
  start,
  resetCount,
  prepared,
  onObservation,
  onTelemetry,
  halted,
  onBindingsChange,
  createRenderer = createCityRenderer,
}: {
  city: City;
  /** The city's collisions with the seeded traffic of the exam. */
  world: World;
  transmission: TransmissionKind;
  /** Where the car starts: the box of leg 1, or the last leg when practising stage III alone (F04-T05). */
  start?: VehicleState;
  resetCount: number;
  prepared: readonly PowertrainCommand[];
  onObservation: (observation: Observation) => void;
  onTelemetry: (telemetry: Telemetry) => void;
  halted: boolean | (() => boolean);
  /** The keys the driver bound, for the page's driving guide (F04-T05-FIX01). */
  onBindingsChange?: (bindings: Bindings) => void;
  createRenderer?: RendererFactory;
}) {
  const createScene = useMemo(() => cityCockpitFactory(city), [city]);
  return (
    <DrivingCanvas
      world={world}
      start={start ?? city.start.pose}
      transmission={transmission}
      label={copy.canvasLabel}
      subtitle={copy.canvasSubtitle}
      loadingText={copy.loading}
      unavailableText={copy.unavailable}
      prepared={prepared}
      resetCount={resetCount}
      onObservation={onObservation}
      onTelemetry={onTelemetry}
      halted={halted}
      {...(onBindingsChange ? { onBindingsChange } : {})}
      createScene={createScene}
      createRenderer={createRenderer}
    />
  );
}
