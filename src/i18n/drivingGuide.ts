import type { GuideStep } from '../exam/guide.ts';
import type { KeyNames } from '../practice/keyLabels.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { COCKPIT_COPY, EXAM_COPY } from './es-AR.ts';

/**
 * Player-facing copy of the driving guide of the exam page (F04-T05-FIX01), kept apart from es-AR.ts for its size.
 * Every instruction takes the keys the driver has bound, so the guide never names a key that does something else.
 * What each step asks for is what the session judges (src/exam/session.ts, parking.ts, circulation.ts).
 */

/** How a key code that is not a letter or a digit reads on screen (bindings.ts accepts no other codes). */
export const KEY_LABELS: Readonly<Record<string, string>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  Space: 'Espacio',
};

/** Between two keys of the same action: "↑ o W". */
export const KEY_SEPARATOR = ' o ';

type Instruction = (keys: KeyNames, kind: TransmissionKind) => string;

const instrumentsPanel = `«${COCKPIT_COPY.instruments}»`;
const lightSelector = `el selector «${COCKPIT_COPY.lights}» del panel ${instrumentsPanel}`;
const readyButton = `«${EXAM_COPY.ready}»`;

/** Moving through the gears in the steps: what to hold down, and the order of the positions. */
const gears = (k: KeyNames, kind: TransmissionKind) =>
  kind === 'manual'
    ? `con ${k.clutch} pisado, ${k.gearUp} sube y ${k.gearDown} baja de a una marcha (R · N · 1 · 2 · 3 · 4 · 5)`
    : `con ${k.brake} pisado, ${k.gearUp} y ${k.gearDown} mueven la palanca de a una posición (P · R · N · D)`;

/** The 30 cm in the box: clutch only in the manual, brake only in the automatic (protocolo PDF 11). */
const creep = (k: KeyNames, kind: TransmissionKind) =>
  kind === 'manual'
    ? `Sin acelerar ni tocar el volante, soltá ${k.clutch}: el embrague sube despacio y, apenas el auto empieza a moverse, volvé a pisarlo; el auto sigue unos centímetros y se detiene. Es una maniobra fina: si lo pisás tarde, el motor se cala. Con el auto medio segundo quieto, se mide. El freno (${k.brake}), solo al final para dejarlo quieto.`
    : `Sin acelerar ni tocar el volante, soltá ${k.brake}: el auto se mueve solo, despacio. Volvé a pisar ${k.brake} unos tres cuartos de segundo después de que empieza a moverse, para recorrer unos 30 cm. Con el auto medio segundo quieto, se mide.`;

const steps: Record<GuideStep, { title: string; how: Instruction }> = {
  familiarisation: {
    title: 'Antes de empezar',
    how: () =>
      `Probá los mandos con calma: nada de esto cuenta. Cuando quieras empezar, tocá ${readyButton}. Al empezar, el auto vuelve a quedar con el motor apagado y la llave en contacto, y el habitáculo vuelve a su posición inicial.`,
  },
  recognition: {
    title: 'Reconocimiento de mandos',
    how: (k, kind) =>
      `Te pide un mando por vez: respondé solo con ese, porque otro de la misma familia cuenta como respuesta equivocada. Pedales: mantené ${
        kind === 'manual'
          ? `${k.clutch} (embrague), ${k.brake} (freno) o ${k.throttle} (acelerador)`
          : `${k.brake} (freno) o ${k.throttle} (acelerador)`
      } hasta que el pedal baje. Caja: ${gears(k, kind)}, siempre hacia la pedida: alejarte de ella es un error. Luces: elegí la pedida en ${lightSelector}, porque ${k.lights} pasa por posición, bajas y altas en orden, y una luz intermedia cuenta como error. Direccionales ${k.signalLeft} y ${k.signalRight}, balizas ${k.hazards}, limpiaparabrisas ${k.wipers} y bocina ${k.horn}; el desempañador, la luneta térmica y el aire acondicionado, con sus botones del mismo panel.`,
  },
  preparation: {
    title: 'Preparación',
    how: (k) =>
      `Abrí «${COCKPIT_COPY.setup}», debajo de la vista, y mové la distancia o la altura del asiento, el apoyacabezas y la orientación de los tres espejos (izquierdo, interior y derecho). Abrochate el cinturón (${k.belt}) y dejá las luces bajas (con ${lightSelector}). Cuando termines, tocá ${readyButton}.`,
  },
  unlock: {
    title: 'Arranque',
    how: (k, kind) =>
      kind === 'manual'
        ? `Dejá la caja en N: con ${k.clutch} pisado, ${k.gearUp} o ${k.gearDown} hasta N. Después tocá ${k.key} una sola vez para arrancar.`
        : `Dejá la palanca en P: con ${k.brake} pisado, ${k.gearDown} hasta P. Después tocá ${k.key} una sola vez para arrancar.`,
  },
  reverse: {
    title: 'Retroceder 30 cm',
    how: (k, kind) =>
      `${
        kind === 'manual'
          ? `Con ${k.clutch} pisado, poné reversa (${k.gearDown} desde N)`
          : `Con ${k.brake} pisado, poné R (${k.gearUp} desde P)`
      } y sacá el freno de mano (${k.handbrake}). ${creep(k, kind)}`,
  },
  forward: {
    title: 'Avanzar 30 cm',
    how: (k, kind) =>
      `${
        kind === 'manual'
          ? `Con ${k.clutch} pisado, poné primera (${k.gearUp} dos veces: R, N, 1).`
          : `Con ${k.brake} pisado, poné D (${k.gearUp} dos veces: R, N, D).`
      } Es una sola maniobra, igual que al retroceder. ${creep(k, kind)}`,
  },
  exit: {
    title: 'Salida del cajón',
    how: (k, kind) =>
      `Antes de moverte, poné la direccional izquierda (${k.signalLeft}), mirá el espejo izquierdo (${k.glanceLeft}) y volvé a mirar al frente (${k.lookCenter}). ${
        kind === 'manual'
          ? `En primera, soltá ${k.clutch} mientras acelerás con toques cortos (${k.throttle})`
          : `En D, soltá ${k.brake} y acelerá con toques cortos (${k.throttle})`
      } y girá a la izquierda (${k.left}) hasta quedar en el carril; soltá el volante para enderezar y apagá la direccional (${k.signalLeft}).`,
  },
  firstMetres: {
    title: 'Primeros 100 m',
    how: (k, kind) =>
      `No pases de 30 km/h: la velocidad se lee en la vista. ${
        kind === 'manual'
          ? `Antes de los 15 km/h pasá a segunda: ${k.clutch} pisado, ${k.gearUp}, y soltalo mientras acelerás.`
          : 'Seguí en D.'
      } Si te indica un giro, preparalo como en la circulación.`,
  },
  circulation: {
    title: 'Circulación',
    how: (k, kind) =>
      `Seguí las indicaciones del examinador. Para doblar, poné la direccional (${k.signalLeft} o ${k.signalRight}) unos 30 m antes, mirá el espejo de ese lado (${k.glanceLeft} o ${k.glanceRight}), volvé al frente (${k.lookCenter}) y bajá a 20 km/h o menos antes de la esquina; apagá la direccional después de doblar. Para cambiar de carril, direccional y espejo unos 3 s antes. Semáforo en rojo o PARE: detenete del todo antes de la línea. Esquina sin semáforo: reducí y cedé el paso a quien viene por tu derecha. Frená ante peatones en la senda. Hasta 30 km/h (45 en Cabildo) y nunca más que la máxima de la vía. Si se acerca una sirena, correte a la derecha o detenete.${
        kind === 'manual' ? ` Para detenerte, pisá también ${k.clutch}, así no se cala.` : ''
      }`,
  },
  parking: {
    title: 'Estacionamiento',
    how: (k, kind) =>
      `Cuando te avisa que vas a estacionar, prendé las balizas (${k.hazards}) por lo menos 3 s antes de detenerte. Parate en doble fila un poco adelante del cajón de la derecha, a más de 1,2 m de su línea, con la cola del auto cerca de la línea de adelante del cajón. Antes de retroceder, mirá un espejo (${k.glanceLeft} o ${k.glanceRight}) o hacia atrás (${k.lookBack}), y otra vez mientras retrocedés. ${
        kind === 'manual'
          ? `Reversa: ${k.clutch} pisado y ${k.gearDown} hasta R.`
          : `Reversa: detenido, ${k.brake} pisado y ${k.gearDown} hasta R.`
      } Despacio, volante a la derecha a tope (${k.right}) hasta quedar en diagonal y después a la izquierda a tope (${k.left}) para enderezar. Quedá centrado, paralelo y a unos 20 cm del cordón. Con el auto detenido, tocá «${EXAM_COPY.parkingDone}». Tenés hasta 3 maniobras y 2 intentos.`,
  },
  leaving: {
    title: 'Bajar del auto',
    how: (k, kind) =>
      `${
        kind === 'manual'
          ? `Con ${k.clutch} pisado, dejá la caja en N (${k.gearUp} o ${k.gearDown})`
          : `Con ${k.brake} pisado, dejá la palanca en P (${k.gearDown})`
      }; poné el freno de mano (${k.handbrake}), apagá las luces (con ${lightSelector}), apagá el motor con ${k.key} y sacá la llave con otro ${k.key}. Mirá el espejo izquierdo (${k.glanceLeft}) y recién entonces abrí la puerta (${k.door}): eso termina el examen.`,
  },
};

export const DRIVING_GUIDE_COPY = {
  heading: 'Cómo manejar en el examen',
  now: 'Qué hacer ahora',
  controlsHeading: 'Teclas',
  /** The controls of the cabin, as they work for the gearbox chosen. */
  controls: (k: KeyNames, kind: TransmissionKind): string[] => [
    `Hacé clic en la vista 3D, o llegá a ella con Tab, para manejar con el teclado. Si cambiás las teclas en «${COCKPIT_COPY.bindings}», esta guía muestra las tuyas. Los botones debajo de la vista hacen lo mismo con el mouse o el dedo.`,
    kind === 'manual'
      ? `Pedales: ${k.throttle} acelerador, ${k.brake} freno y ${k.clutch} embrague. Mientras mantenés la tecla, el pedal baja hasta el fondo; al soltarla, sube. El embrague sube despacio: con toques cortos queda a medio camino.`
      : `Pedales: ${k.throttle} acelerador y ${k.brake} freno. Mientras mantenés la tecla, el pedal baja hasta el fondo; al soltarla, sube.`,
    `Volante: ${k.left} a la izquierda y ${k.right} a la derecha. Gira mientras mantenés la tecla y vuelve solo al centro al soltarla.`,
    kind === 'manual'
      ? `Caja: con ${k.clutch} pisado, ${k.gearUp} sube y ${k.gearDown} baja de a una marcha (R · N · 1 · 2 · 3 · 4 · 5).`
      : `Caja: ${k.gearUp} y ${k.gearDown} mueven la palanca de a una posición (P · R · N · D); para sacarla de P, pisá el freno (${k.brake}).`,
    `Llave: ${k.key}, un paso por vez (contacto, arranque, apagado y sacarla). Freno de mano: ${k.handbrake} lo pone o lo saca; el auto empieza con el freno de mano puesto.`,
    `Luces: ${k.lights}, en orden (apagadas, posición, bajas y altas), o directo con ${lightSelector}. Direccionales: ${k.signalLeft} y ${k.signalRight}; la misma tecla la apaga, no se apaga sola. Balizas ${k.hazards}, cinturón ${k.belt}, limpiaparabrisas ${k.wipers} y bocina ${k.horn}.`,
    `Mirar: ${k.glanceLeft} mira el espejo izquierdo y ${k.glanceRight} el derecho; solo así cuenta como mirar un espejo. ${k.lookLeft} y ${k.lookRight} giran toda la cabeza y no lo reemplazan; ${k.lookBack} mira hacia atrás, que vale al estacionar marcha atrás. La vista queda girada hasta que tocás ${k.lookCenter}, que vuelve al frente; también podés arrastrar sobre el parabrisas.`,
    `Puerta: ${k.door} la abre para bajar, al final del examen. La velocidad (km/h) y la marcha se leen en la vista.`,
  ],
  stepsHeading: 'Paso a paso',
  stepsHidden:
    'En el modo rendir no se muestra el paso a paso, como en el examen real: hacé lo que pide el examinador. Las teclas son del juego y quedan a la vista.',
  steps,
} as const;
