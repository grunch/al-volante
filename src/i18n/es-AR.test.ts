import { describe, expect, it } from 'vitest';
import {
  CITY_COPY,
  EXAM_COPY,
  HOME_SPACES,
  LOGBOOK_COPY,
  THEORY_COPY,
  TRACK_COPY,
  formatDate,
  formatDateTime,
  formatNumber,
  sectionLabel,
} from './es-AR.ts';

describe('number and date formatting (es-AR)', () => {
  it('writes numbers with a decimal comma, a thousands point and the digits asked for', () => {
    expect(formatNumber(1507, 0)).toBe('1.507');
    expect(formatNumber(2.25, 1)).toBe('2,3');
    expect(formatNumber(0, 1)).toBe('0,0');
  });

  it('writes dates in Spanish, with the time when asked', () => {
    // Midday UTC keeps the same calendar day in any time zone the tests may run in.
    const iso = '2026-10-12T12:00:00.000Z';

    expect(formatDate(iso)).toMatch(/^12 oct 2026$/);
    expect(formatDateTime(iso)).toMatch(/^12 oct 2026, \d{1,2}:\d{2}/);
  });
});

describe('sectionLabel', () => {
  it('names a known section and falls back to the raw id for an unknown one, so a new section never renders blank', () => {
    expect(sectionLabel('manual', 'ch3')).toBe('Cap. 3 · Normas básicas de conducción');
    expect(sectionLabel('manual', 'ch9')).toBe('ch9');
    expect(sectionLabel('unknown-source', 'intro')).toBe('intro');
  });
});

describe('singular and plural in the logbook', () => {
  it('speaks of one damaged record in the singular and of several in the plural', () => {
    expect(LOGBOOK_COPY.quarantined(1)).toBe(
      'Un registro guardado estaba dañado y lo apartamos sin modificarlo. No afecta el resto de tu progreso.',
    );
    expect(LOGBOOK_COPY.quarantined(3)).toBe(
      '3 registros guardados estaban dañados y los apartamos sin modificarlos. No afectan el resto de tu progreso.',
    );
  });

  it('counts unsaved results, attempts and concepts with the right number', () => {
    expect(LOGBOOK_COPY.unsaved(1)).toMatch(/^Un resultado no se pudo guardar en este navegador\./);
    expect(LOGBOOK_COPY.unsaved(4)).toMatch(/^4 resultados no se pudieron guardar en este navegador\./);
    expect(LOGBOOK_COPY.importSummary('12 oct 2026', 1, 1)).toBe('Respaldo del 12 oct 2026: 1 intento y 1 concepto.');
    expect(LOGBOOK_COPY.importSummary('12 oct 2026', 0, 2)).toBe('Respaldo del 12 oct 2026: 0 intentos y 2 conceptos.');
    expect(LOGBOOK_COPY.importWarning(1)).toBe('Importarlo reemplaza tu progreso actual (1 intento).');
  });

  it('agrees the concepts of a group and the ones with activities in number', () => {
    expect(LOGBOOK_COPY.groupSummary(1, 1)).toBe('1 concepto; 1 ya tiene actividades para practicar.');
    expect(LOGBOOK_COPY.groupSummary(40, 1)).toBe('40 conceptos; 1 ya tiene actividades para practicar.');
    expect(LOGBOOK_COPY.groupSummary(40, 12)).toBe('40 conceptos; 12 ya tienen actividades para practicar.');
  });

  it('names the completed stages of a drive in the singular when there is only one', () => {
    expect(LOGBOOK_COPY.drivingStages([])).toBe('ninguna etapa completa');
    expect(LOGBOOK_COPY.drivingStages(['I'])).toBe('etapa completa: I');
    expect(LOGBOOK_COPY.drivingStages(['I', 'II', 'III'])).toBe('etapas completas: I, II, III');
  });

  it('writes the points of a drive, or that it has none', () => {
    expect(LOGBOOK_COPY.drivingPoints(null)).toBe('sin puntaje');
    expect(LOGBOOK_COPY.drivingPoints(1)).toBe('1 punto');
    expect(LOGBOOK_COPY.drivingPoints(0)).toBe('0 puntos');
  });
});

describe('singular and plural in the theory mock exam', () => {
  it('says that one unanswered question counts as wrong, in the singular', () => {
    expect(THEORY_COPY.unanswered(1)).toBe('Sin responder: 1 (cuenta como incorrecta).');
    expect(THEORY_COPY.unanswered(3)).toBe('Sin responder: 3 (cuentan como incorrectas).');
  });

  it('warns about a short bank with the right number of questions', () => {
    expect(THEORY_COPY.shortBank(1, 40)).toBe(
      'Por ahora hay 1 pregunta disponible de las 40 del examen: este simulacro no puede aprobarse.',
    );
    expect(THEORY_COPY.shortBank(12, 40)).toBe(
      'Por ahora hay 12 preguntas disponibles de las 40 del examen: este simulacro no puede aprobarse.',
    );
  });

  it('summarises the paper and the score with the number of each noun', () => {
    expect(THEORY_COPY.introSummary(40, 34, 3, 45)).toBe(
      '40 preguntas de opción múltiple con 3 opciones y una sola correcta, tomadas de todo el material de la licencia B y repartidas por tema. Aprobás con 34 correctas. Tenés 45 minutos.',
    );
    expect(THEORY_COPY.introSummary(1, 1, 3, 45)).toMatch(/^1 pregunta de opción múltiple .* Aprobás con 1 correcta\./);
    expect(THEORY_COPY.score(33, 40, 34)).toBe('33 de 40 respuestas correctas (se necesitan 34).');
    expect(THEORY_COPY.score(1, 2, 1)).toBe('1 de 2 respuestas correctas (se necesita 1).');
    expect(THEORY_COPY.logbookRow(20, 40, false)).toBe('20 de 40 · No aprobado');
  });
});

describe('exam copy', () => {
  it('writes points, subtotals and totals with "punto" for one and "puntos" otherwise', () => {
    expect(EXAM_COPY.faultPoints(1)).toBe('1 punto');
    expect(EXAM_COPY.faultPoints(8)).toBe('8 puntos');
    expect(EXAM_COPY.subtotal(1)).toBe('Subtotal: 1 punto');
    expect(EXAM_COPY.total(0)).toBe('Total: 0 puntos');
    expect(EXAM_COPY.verdicts.approved(1)).toMatch(/^Aprobado con 1 punto:/);
    expect(EXAM_COPY.verdicts.approved(7)).toMatch(/^Aprobado con 7 puntos:/);
    expect(EXAM_COPY.verdicts.overPoints(9)).toMatch(/^Desaprobado: 9 puntos;/);
  });

  it('tells when a fault happened in whole seconds, without "los" before a single second', () => {
    expect(EXAM_COPY.faultAt(12.4)).toBe('a los 12 s');
    expect(EXAM_COPY.faultAt(0.8)).toBe('a 1 s');
    expect(EXAM_COPY.stageDuration(59.6)).toBe('60 s');
  });

  it('counts parking manoeuvres and attempts with the right number', () => {
    expect(EXAM_COPY.parkingCountersOf(1, 1)).toBe('1 maniobra · 1 intento');
    expect(EXAM_COPY.parkingCountersOf(0, 2)).toBe('0 maniobras · 2 intentos');
  });

  it('rounds the distances the examiner and the HUD announce to whole metres and centimetres', () => {
    expect(EXAM_COPY.notices.signal(42.6)).toBe('Semáforo a 43 m.');
    expect(EXAM_COPY.notices.stop(9.2)).toBe('PARE a 9 m: detención completa antes de la línea.');
    expect(EXAM_COPY.notices.priority(15.5)).toBe('Esquina sin semáforo a 16 m: reducí y mirá a tu derecha.');
    expect(EXAM_COPY.notices.bump(30)).toBe('Lomo de burro a 30 m.');
    // An ambulance behind has no distance to announce: what to do is enough.
    expect(EXAM_COPY.notices.emergency()).toBe(
      'Vehículo de emergencia con sirena: hacele lugar a la derecha o detenete.',
    );
    expect(EXAM_COPY.parkingNotice(99.7)).toBe(
      'Vamos a estacionar: el cajón está a 100 m, sobre Quesada, a la derecha.',
    );
    expect(EXAM_COPY.bayAhead(7.4)).toBe('cajón a 7 m');
    expect(EXAM_COPY.kerbDistanceOf(19.6, 22.4)).toBe('adelante 20 cm · atrás 22 cm');
  });

  it('turns left or right by the named street, and says when a road has no posted limit', () => {
    expect(EXAM_COPY.instruction('left', 'Av. Cabildo')).toBe(
      'En la próxima esquina, doblá a la izquierda, por Av. Cabildo.',
    );
    expect(EXAM_COPY.instruction('right', 'Quesada')).toBe('En la próxima esquina, doblá a la derecha, por Quesada.');
    expect(EXAM_COPY.limitsOf(30, null)).toBe('30 km/h de examen · máxima de la vía sin dato (OSM, sin confirmar)');
    expect(EXAM_COPY.limitsOf(45, 60)).toBe('45 km/h de examen · máxima de la vía 60 km/h (OSM, sin confirmar)');
  });

  it('cites protocol pages and the rule that interrupted the exam', () => {
    expect(EXAM_COPY.protocolPage(14)).toBe('PDF 14');
    expect(EXAM_COPY.interruptedBy('Cruza con el semáforo en rojo')).toBe('Motivo: Cruza con el semáforo en rojo.');
    expect(EXAM_COPY.verdicts.eliminatory('Sube a la vereda')).toMatch(
      /^Desaprobado por una falla eliminatoria .*: Sube a la vereda/,
    );
  });
});

describe('driving copy', () => {
  it('names what the car touched in the practice yard', () => {
    expect(TRACK_COPY.contact(TRACK_COPY.obstacleNames.curb)).toBe('Tocaste el cordón. El auto se detuvo.');
  });

  it('numbers the legs of the route with their street', () => {
    expect(CITY_COPY.leg(3, 'Av. Cabildo')).toBe('3. Av. Cabildo');
    expect(EXAM_COPY.leg(3, 'Av. Cabildo')).toBe('Tramo 3 · Av. Cabildo');
  });
});

describe('features announced as coming soon', () => {
  // The full practical exam exists since F04-T03–T05 (`#/examen`); copy must not promise it for a later task.
  const FUTURE = /próximas tareas|llega en|todavía no evalúa/i;

  it('does not announce the evaluation of the whole circuit as a future task', () => {
    expect(CITY_COPY.scope).not.toMatch(FUTURE);
    expect(CITY_COPY.scope).toMatch(/no se puntúa/);
    expect(TRACK_COPY.intro).not.toMatch(FUTURE);
  });

  it('keeps one home space per proposal space, the road lab being the only one still to come', () => {
    expect(HOME_SPACES.map((space) => space.id)).toEqual(['garage', 'city', 'lab', 'route', 'exam', 'logbook']);
  });
});
