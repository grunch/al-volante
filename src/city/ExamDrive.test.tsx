import { render } from '@testing-library/react';
import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { EXAM_COPY } from '../i18n/es-AR.ts';
import { DrivingCanvas } from '../practice/DrivingCanvas.tsx';
import { ExamDrive } from './ExamDrive.tsx';
import { buildCity, entryPose } from './model.ts';

vi.mock('../practice/DrivingCanvas.tsx', () => ({ DrivingCanvas: vi.fn(() => null) }));

const city = buildCity(RouteSchema.parse(routeData));
const lastProps = () => vi.mocked(DrivingCanvas).mock.calls.at(-1)![0];
const base = {
  city,
  world: city.world,
  transmission: 'manual' as const,
  resetCount: 0,
  prepared: [],
  onObservation: vi.fn(),
  onTelemetry: vi.fn(),
  halted: false,
};

afterEach(() => vi.mocked(DrivingCanvas).mockClear());

describe('exam drive', () => {
  it('starts in the parking bay of leg 1 unless a start is given, with the exam texts', () => {
    // Act
    const view = render(<ExamDrive {...base} />);
    const fromBay = lastProps();
    const lastLeg = entryPose(city, 8);
    view.rerender(<ExamDrive {...base} start={lastLeg} />);

    // Assert
    expect(fromBay.start).toBe(city.start.pose);
    expect(lastProps().start).toBe(lastLeg);
    expect(fromBay).toMatchObject({
      world: city.world,
      label: EXAM_COPY.canvasLabel,
      subtitle: EXAM_COPY.canvasSubtitle,
      loadingText: EXAM_COPY.loading,
      unavailableText: EXAM_COPY.unavailable,
      onObservation: base.onObservation,
      onTelemetry: base.onTelemetry,
    });
    expect(lastProps().createScene).toBe(fromBay.createScene);
  });

  it('forwards the bindings listener only when the page asks for it', () => {
    const onBindingsChange = vi.fn();
    const view = render(<ExamDrive {...base} />);
    expect('onBindingsChange' in lastProps()).toBe(false);
    view.rerender(<ExamDrive {...base} onBindingsChange={onBindingsChange} />);
    expect(lastProps().onBindingsChange).toBe(onBindingsChange);
  });
});
