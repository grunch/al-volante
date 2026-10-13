import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CockpitControls } from './CockpitControls.tsx';
import { DEFAULT_BINDINGS } from './bindings.ts';
import type { Action } from './bindings.ts';
import { initialCockpit } from './cockpit.ts';
import type { CockpitCommand, CockpitState } from './cockpit.ts';

function renderControls(
  overrides: { state?: CockpitState; automatic?: boolean; storageError?: boolean; bindResult?: boolean } = {},
) {
  const command = vi.fn<(command: CockpitCommand) => void>();
  const start = vi.fn<(action: Action, source: string) => void>();
  const stop = vi.fn<(source: string) => void>();
  const bind = vi.fn<(action: Action, code: string) => boolean>(() => overrides.bindResult ?? true);
  const restore = vi.fn<() => void>();
  render(
    <CockpitControls
      state={overrides.state ?? initialCockpit()}
      command={command}
      start={start}
      stop={stop}
      bindings={DEFAULT_BINDINGS}
      bind={bind}
      restore={restore}
      storageError={overrides.storageError ?? false}
      automatic={overrides.automatic ?? false}
    />,
  );
  return { command, start, stop, bind, restore };
}

describe('cockpit hold buttons', () => {
  beforeEach(() => {
    // jsdom has no PointerEvent; a MouseEvent carries the button the handlers read.
    vi.stubGlobal('PointerEvent', MouseEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('holds a pedal from the primary pointer press until release, cancel or lost capture', () => {
    // Arrange
    const { start, stop } = renderControls();
    const brake = screen.getByRole('button', { name: 'Frenar' });
    brake.setPointerCapture = vi.fn();

    // Act
    fireEvent.pointerDown(brake, { button: 0 });
    fireEvent.pointerUp(brake);
    fireEvent.pointerCancel(brake);
    fireEvent.lostPointerCapture(brake);

    // Assert: one press, captured so a sliding finger keeps it; every way the pointer ends releases it.
    expect(start).toHaveBeenCalledExactlyOnceWith('brake', expect.stringMatching(/^pointer-/));
    expect(brake.setPointerCapture).toHaveBeenCalledOnce();
    const source = start.mock.calls[0]?.[1];
    expect(stop.mock.calls).toEqual([[source], [source], [source]]);
  });

  it('ignores secondary pointer buttons, so a right click does not press a pedal', () => {
    const { start } = renderControls();
    const throttle = screen.getByRole('button', { name: 'Acelerar' });
    throttle.setPointerCapture = vi.fn();

    fireEvent.pointerDown(throttle, { button: 2 });

    expect(start).not.toHaveBeenCalled();
    expect(throttle.setPointerCapture).not.toHaveBeenCalled();
  });

  it('holds with Space or Enter without auto-repeat presses, and releases on key up or blur', () => {
    // Arrange
    const { start, stop } = renderControls();
    const left = screen.getByRole('button', { name: 'Volante a la izquierda' });

    // Act
    fireEvent.keyDown(left, { code: 'Space' });
    fireEvent.keyDown(left, { code: 'Space', repeat: true });
    fireEvent.keyUp(left, { code: 'Space' });
    fireEvent.keyDown(left, { code: 'Enter' });
    fireEvent.blur(left);

    // Assert
    expect(start.mock.calls).toEqual([
      ['left', 'button-left'],
      ['left', 'button-left'],
    ]);
    expect(stop.mock.calls).toEqual([['button-left'], ['button-left']]);
  });

  it('leaves other keys to the browser', () => {
    const { start, stop } = renderControls();
    const right = screen.getByRole('button', { name: 'Volante a la derecha' });

    const keyDown = fireEvent.keyDown(right, { code: 'KeyA' });
    const keyUp = fireEvent.keyUp(right, { code: 'KeyA' });

    expect(keyDown).toBe(true);
    expect(keyUp).toBe(true);
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  it('turns a semantic click into a tap and ignores the click that follows a pointer press', () => {
    const { start, stop } = renderControls();
    const horn = screen.getByRole('button', { name: 'Bocina' });

    fireEvent.click(horn, { detail: 1 });
    fireEvent.click(horn, { detail: 0 });

    expect(start).toHaveBeenCalledExactlyOnceWith('horn', 'click-horn');
    expect(stop).toHaveBeenCalledExactlyOnceWith('click-horn');
  });

  it('shows the clutch pedal only with the manual gearbox', () => {
    renderControls({ automatic: true });
    expect(screen.queryByRole('button', { name: 'Embrague' })).not.toBeInTheDocument();
  });
});

describe('cockpit command buttons', () => {
  it('sends key, handbrake, gears, door and look buttons as one-off actions', () => {
    // Arrange
    const { start, stop } = renderControls({ state: { ...initialCockpit(), door: true } });
    const names: [string, Action][] = [
      ['Accionar llave', 'key'],
      ['Accionar freno de mano', 'handbrake'],
      ['Bajar marcha', 'gearDown'],
      ['Subir marcha', 'gearUp'],
      ['Abrir la puerta y bajar', 'door'],
      ['Mirar el espejo izquierdo', 'glanceLeft'],
      ['Mirar a la izquierda', 'lookLeft'],
      ['Mirar al frente', 'lookCenter'],
      ['Mirar a la derecha', 'lookRight'],
      ['Mirar el espejo derecho', 'glanceRight'],
      ['Mirar hacia atrás', 'lookBack'],
    ];

    // Act
    for (const [name] of names) fireEvent.click(screen.getByRole('button', { name }));

    // Assert
    expect(start.mock.calls).toEqual(names.map(([, action]) => [action, 'command']));
    expect(stop).toHaveBeenCalledTimes(names.length);
    expect(stop).toHaveBeenLastCalledWith('command');
    expect(screen.getByRole('button', { name: 'Abrir la puerta y bajar' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles cabin equipment and shows each switch state', () => {
    const { command } = renderControls({ state: { ...initialCockpit(), defogger: true } });

    fireEvent.click(screen.getByRole('button', { name: /Desempañador delantero/ }));
    fireEvent.click(screen.getByRole('button', { name: /Calefacción/ }));

    expect(command.mock.calls).toEqual([
      [{ type: 'toggle', control: 'defogger' }],
      [{ type: 'toggle', control: 'heating' }],
    ]);
    expect(screen.getByRole('button', { name: /Desempañador delantero/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Desempañador delantero/ })).toHaveTextContent('Activado');
    expect(screen.getByRole('button', { name: /Calefacción/ })).toHaveTextContent('Desactivado');
  });

  it('switches a turn signal on, swaps sides, and switches it off when pressed again', () => {
    const { command } = renderControls({ state: { ...initialCockpit(), signal: 'left' } });

    fireEvent.click(screen.getByRole('button', { name: 'Giro izquierdo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Giro derecho' }));

    expect(command.mock.calls).toEqual([[{ type: 'signal', value: 'off' }], [{ type: 'signal', value: 'right' }]]);
    expect(screen.getByRole('button', { name: 'Giro izquierdo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Giro derecho' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('selects the lights and shows the horn only while it sounds', () => {
    const { command } = renderControls({ state: { ...initialCockpit(), horn: true } });

    fireEvent.change(screen.getByRole('combobox', { name: 'Iluminación' }), { target: { value: 'high' } });

    expect(command).toHaveBeenCalledExactlyOnceWith({ type: 'lights', value: 'high' });
    expect(screen.getByText('Bocina activada (representación visual)')).toHaveAttribute('role', 'status');
  });

  it('adjusts the seat, the headrest and each mirror axis with numeric values', () => {
    const { command } = renderControls();

    fireEvent.change(screen.getByRole('slider', { name: 'Distancia del asiento' }), { target: { value: '0.8' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Altura del apoyacabezas' }), { target: { value: '0.2' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Interior: Orientación vertical' }), {
      target: { value: '-0.3' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Derecho: Orientación horizontal' }), {
      target: { value: '0.25' },
    });

    expect(command.mock.calls).toEqual([
      [{ type: 'adjust', control: 'seatDistance', value: 0.8 }],
      [{ type: 'adjust', control: 'headrest', value: 0.2 }],
      [{ type: 'mirror', mirror: 'center', axis: 'pitch', value: -0.3 }],
      [{ type: 'mirror', mirror: 'right', axis: 'yaw', value: 0.25 }],
    ]);
  });
});

describe('keyboard bindings panel', () => {
  /** A binding button is named by its command followed by its keys. */
  const bindingButton = (command: string, keys: string) =>
    screen.getByRole('button', { name: new RegExp(`^${command}\\s?${keys}$`) });

  it('names keys as the driving guide does instead of showing raw key codes', () => {
    renderControls();

    expect(bindingButton('Acelerar', '↑ o W')).not.toHaveTextContent('ArrowUp');
    expect(bindingButton('Embrague', 'Shift')).not.toHaveTextContent('ShiftLeft');
  });

  it('waits for a key after a command is chosen and binds it', () => {
    // Arrange
    const { bind } = renderControls();
    const horn = bindingButton('Bocina', 'H');

    // Act: a key before choosing does nothing; after choosing, the key is bound.
    fireEvent.keyDown(horn, { code: 'Digit5' });
    fireEvent.click(horn);
    const waiting = horn.textContent;
    const handled = fireEvent.keyDown(horn, { code: 'Digit5' });

    // Assert
    expect(waiting).toContain('Pulsá una tecla…');
    expect(bind).toHaveBeenCalledExactlyOnceWith('horn', 'Digit5');
    expect(handled).toBe(false);
    expect(horn).toHaveTextContent('H');
    expect(horn).not.toHaveTextContent('KeyH');
    expect(screen.getAllByRole('status').at(-1)).toHaveTextContent('');
  });

  it('reports a key that is taken or combined with a modifier, and keeps waiting', () => {
    const { bind } = renderControls({ bindResult: false });
    const lights = bindingButton('Cambiar luces', 'O');

    fireEvent.click(lights);
    fireEvent.keyDown(lights, { code: 'KeyW' });
    fireEvent.keyDown(lights, { code: 'KeyT', ctrlKey: true });
    fireEvent.keyDown(lights, { code: 'KeyT', altKey: true });
    fireEvent.keyDown(lights, { code: 'KeyT', metaKey: true });

    expect(bind).toHaveBeenCalledExactlyOnceWith('lights', 'KeyW');
    expect(screen.getByText('Esa tecla está ocupada o reservada. Probá otra.')).toHaveAttribute('role', 'status');
    expect(lights).toHaveTextContent('Pulsá una tecla…');
  });

  it('cancels waiting with Escape, lets Tab leave the panel, and stops waiting on blur', () => {
    // Arrange
    const { bind } = renderControls();
    const wipers = bindingButton('Limpiaparabrisas', 'F');

    // Act and assert: Escape is consumed, Tab is left to the browser to move focus.
    fireEvent.click(wipers);
    expect(fireEvent.keyDown(wipers, { code: 'Escape' })).toBe(false);
    expect(wipers).toHaveTextContent('F');
    fireEvent.click(wipers);
    expect(fireEvent.keyDown(wipers, { code: 'Tab' })).toBe(true);
    expect(wipers).toHaveTextContent('F');
    fireEvent.click(wipers);
    fireEvent.blur(wipers);
    expect(wipers).toHaveTextContent('F');
    expect(bind).not.toHaveBeenCalled();
  });

  it('clears a conflict when another command is chosen and restores the default keys on request', () => {
    const { restore } = renderControls({ bindResult: false });
    const belt = bindingButton('Cinturón', 'C');
    fireEvent.click(belt);
    fireEvent.keyDown(belt, { code: 'KeyW' });

    fireEvent.click(bindingButton('Balizas', 'V'));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar teclas' }));

    expect(screen.queryByText('Esa tecla está ocupada o reservada. Probá otra.')).not.toBeInTheDocument();
    expect(restore).toHaveBeenCalledOnce();
  });

  it('warns when the keys cannot be saved in this browser', () => {
    renderControls({ storageError: true });

    expect(
      screen.getByText('No se pudo guardar el teclado en este navegador. Los cambios funcionan durante esta sesión.'),
    ).toHaveAttribute('role', 'status');
  });
});
