// Player-facing copy in Rioplatense Spanish. Keys stay in English (see AGENTS.md, "Idiomas").
export const esAR = {
  appTitle: 'Al volante: Comuna 13',
  appTagline: 'Prepará el examen de licencia B en Núñez, de la teoría al volante.',
  skipToContent: 'Saltar al contenido',
  mainNavigation: 'Navegación principal',
  navHome: 'Inicio',
  navMap: 'Mapa de aprendizaje',
  navLibrary: 'Biblioteca',
  navActivities: 'Actividades',
  navLogbook: 'Mi bitácora',
  navExam: 'Examen',
  garageHeading: 'Mi garaje',
  garageSceneLabel: 'Vista 3D del garaje con un auto de práctica',
  garageSceneLoading: 'Cargando el garaje…',
  garageSceneUnavailable:
    'Tu navegador no pudo iniciar los gráficos 3D (WebGL). Podés seguir usando la parte teórica sin problemas.',
  homeIntro:
    'Estudiá el manual completo y el protocolo del examen práctico. Cada explicación cita la página del material oficial.',
  spacesHeading: 'Espacios',
  comingSoon: 'Próximamente',
  available: 'Disponible',
  footerSources: 'Contenido basado en material público del Gobierno de la Ciudad de Buenos Aires. Proyecto no oficial.',
  contentLoading: 'Cargando el material de estudio…',
  contentError: 'No pudimos cargar el material de estudio.',
  contentErrorDetails: 'Detalle técnico',
  retry: 'Reintentar',
  mapHeading: 'Mapa de aprendizaje',
  mapIntro:
    'La campaña B sigue el «Material a estudiar» de la licencia B (manual, página 3). El material complementario se muestra aparte y no afecta tu progreso de la licencia B.',
  mapCampaignB: 'Campaña licencia B',
  mapReference: 'Consulta',
  mapComplementary: 'Material complementario',
  unitsCount: 'unidades',
  unitsWithActivities: 'con actividades',
  sectionUnitsHeading: 'Unidades de conocimiento',
  sectionPages: 'Páginas del manual',
  figureBased: 'Contenido en figura',
  seeSourcePage: 'Ver página',
  libraryHeading: 'Biblioteca',
  libraryIntro:
    'Material oficial usado por el juego, página por página. El texto extraído puede tener errores: ante cualquier duda, consultá el PDF original.',
  edition: 'Edición',
  pagesLabel: 'páginas',
  browseSource: 'Explorar páginas',
  officialPdf: 'PDF oficial',
  officialPdfAtPage: 'Abrir el PDF oficial en esta página',
  pageLabel: 'Página',
  printedPageLabel: 'página impresa',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  goToPage: 'Ir a la página',
  go: 'Ir',
  pageSummary: 'Resumen',
  pageUnits: 'Unidades en esta página',
  pageFigures: 'Figuras e infografías',
  pageSigns: 'Señales',
  pageIssues: 'Observaciones sobre la fuente',
  pageRules: 'Reglas del examen que citan esta página',
  pageNotCatalogued: 'Esta fuente no tiene un catálogo por página; se muestra el texto extraído.',
  extractedText: 'Texto extraído automáticamente',
  extractedTextLoading: 'Cargando el texto…',
  extractedTextEmpty: 'Esta página no tiene texto extraíble (puede ser solo imagen).',
  extractedTextError: 'No pudimos cargar el texto de esta página. Probá abrir el PDF oficial.',
  notFoundHeading: 'No encontramos esa página',
  notFoundBody: 'Puede que el enlace esté mal escrito o que el contenido todavía no exista.',
  backHome: 'Volver al inicio',
  invalidPage: 'Esa página no existe en esta fuente.',
} as const;

export type MessageKey = keyof typeof esAR;

/** Returns the Spanish copy for a message key; the key type makes missing strings a compile error. */
export function t(key: MessageKey): string {
  return esAR[key];
}

/** Section titles from the manual index (manual PDF 12–13) and the crash guide index (siniestros PDF 2). */
export const SECTION_LABELS: Record<string, Record<string, string>> = {
  manual: {
    front: 'Presentación y material a estudiar',
    glossary: 'Glosario',
    toc: 'Índice',
    intro: 'Introducción',
    ch1: 'Cap. 1 · Hacia una movilidad sustentable',
    ch2: 'Cap. 2 · Conducir es un acto de responsabilidad',
    ch3: 'Cap. 3 · Normas básicas de conducción',
    ch4: 'Cap. 4 · Capacidad natural',
    ch5: 'Cap. 5 · Actitud al conducir',
    annex1: 'Anexo I · Automóviles particulares',
    annex2: 'Anexo II · Transporte de pasajeros/as',
    annex3: 'Anexo III · Transporte de carga y mercaderías',
    annex4: 'Anexo IV · Señales viales',
    back: 'Contratapa',
  },
  siniestros: {
    front: 'Presentación',
    intro: 'Introducción',
    s1: '¿Qué hacer ante un siniestro vial?',
    s2: 'El reclamo ante la compañía de seguros',
    s3: 'Pasos posteriores al siniestro',
    back: 'Contratapa',
  },
};

export const CATEGORY_LABELS: Record<string, string> = {
  B: 'Licencia B',
  common: 'Consulta general',
  D: 'Complementario: transporte de pasajeros/as',
  'C-E': 'Complementario: transporte de carga',
  guide: 'Guía de siniestros',
};

export const PAGE_KIND_LABELS: Record<string, string> = {
  instructional: 'Contenido',
  'chapter-cover': 'Portada de sección',
  'closing-quote': 'Frase de cierre',
  toc: 'Índice',
  cover: 'Tapa',
  credits: 'Créditos',
  blank: 'En blanco',
  other: 'Otra',
};

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  discrepancy: 'Discrepancia',
  illegible: 'Ilegible',
  typo: 'Errata',
  outdated: 'Posiblemente desactualizado',
  ambiguous: 'Ambiguo',
  extraction: 'Falla de extracción',
};

/** Human label for a section; falls back to the raw id so a new section never renders blank. */
export function sectionLabel(source: string, section: string): string {
  return SECTION_LABELS[source]?.[section] ?? section;
}

export const SEVERITY_LABELS: Record<string, string> = {
  minor: 'Leve',
  low: 'Deficiente baja',
  high: 'Deficiente alta',
  eliminatory: 'Eliminatoria',
};

/** The six spaces of PROPUESTA §2, in its order. */
export const HOME_SPACES = [
  {
    id: 'garage',
    title: 'Mi garaje',
    description: 'Explorá el auto, la postura, los espejos y los elementos de seguridad.',
  },
  {
    id: 'city',
    title: 'La ciudad te pregunta',
    description: 'Resolvé escenas de prioridades, señales, semáforos y giros (muestra inicial).',
  },
  {
    id: 'lab',
    title: 'Laboratorio vial',
    description: 'Compará distancias de reacción y frenado, lluvia y puntos ciegos.',
  },
  { id: 'route', title: 'Ruta 13', description: 'Conducí el recorrido A de Núñez desde el interior del auto.' },
  { id: 'exam', title: 'Sala de examen', description: 'Simulacros del teórico equilibrados por tema.' },
  {
    id: 'logbook',
    title: 'Mi bitácora',
    description: 'Revisá tus errores, los repasos pendientes y cómo vas con cada concepto.',
  },
] as const;

export type HomeSpaceId = (typeof HOME_SPACES)[number]['id'];

export const ACTIVITY_COPY = {
  heading: 'La ciudad te pregunta',
  intro:
    'Escenas y preguntas para practicar lo que estudiás. Esta es una muestra inicial: la campaña completa, con actividades para todo el manual, llega en la fase 5.',
  answer: 'Responder',
  check: 'Comprobar',
  correct: '¡Correcto!',
  incorrect: 'No es correcto',
  partial: 'Casi',
  explanation: 'Por qué',
  correctAnswer: 'Respuesta correcta',
  sources: 'Fuentes',
  anotherVariant: 'Otra variante',
  backToList: 'Volver a las actividades',
  moveUp: 'Subir',
  moveDown: 'Bajar',
  position: 'Posición',
  restart: 'Empezar de nuevo',
  chooseOption: 'Elegí una opción',
  scoreLabel: 'Puntaje',
  notFound: 'No encontramos esa actividad.',
  signToIdentify: 'Señal a identificar',
  notSaved:
    'No pudimos guardar este resultado en tu bitácora. Podés seguir practicando; el resto de tu progreso está intacto.',
} as const;

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  'single-choice': 'Elección',
  'sign-identification': 'Señales',
  ordering: 'Ordenar',
  decision: 'Decisión',
};

export const SOURCE_SHORT_LABELS: Record<string, string> = {
  manual: 'Manual',
  protocolo: 'Protocolo',
  recorridos: 'Recorridos',
  siniestros: 'Guía de siniestros',
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const LOGBOOK_COPY = {
  heading: 'Mi bitácora',
  intro:
    'Tus errores recientes, los repasos que tocan y cómo vas con cada concepto. Todo se guarda solo en este navegador.',
  loading: 'Cargando tu progreso…',
  loadError: 'No pudimos leer tu progreso guardado. No se borró nada.',
  retry: 'Reintentar',
  notPersistent:
    'Este navegador no permite guardar datos (por ejemplo, en modo privado): tu progreso se pierde al cerrar la pestaña. Descargá un respaldo para conservarlo.',
  quarantined: (count: number) =>
    `${count === 1 ? 'Un registro guardado estaba dañado y lo' : `${count} registros guardados estaban dañados y los`} apartamos sin modificarlos. No afectan el resto de tu progreso.`,
  unsaved: (count: number) =>
    `${count === 1 ? 'Un resultado no se pudo guardar' : `${count} resultados no se pudieron guardar`} en este navegador. El resto de tu progreso está intacto.`,
  acknowledge: 'Entendido',
  reviewHeading: 'Repaso recomendado',
  reviewEmpty: 'No tenés repasos pendientes por ahora.',
  reviewTryNew: 'Probá una actividad',
  reasonRecentError: 'La última vez no te salió bien.',
  reasonDue: 'Toca repasar:',
  errorsHeading: 'Errores recientes',
  errorsEmpty: 'Sin errores registrados.',
  errorOn: (date: string) => `Último intento: ${date}`,
  conceptsHeading: 'Progreso por concepto',
  masteryHelp:
    'Un concepto queda dominado con tres respuestas correctas seguidas y espaciadas: la primera, otra al menos un día después y otra al menos tres días más tarde. Responder de nuevo antes de tiempo no suma, y un error lo vuelve al principio. No calculamos una probabilidad de aprobar.',
  groupSummary: (total: number, withActivities: number) =>
    `${total} conceptos; ${withActivities} ya tienen actividades para practicar.`,
  practicedCount: 'Practicados',
  masteredCount: 'Dominados',
  stateLabels: { practiced: 'Practicado', mastered: 'Dominado' },
  conceptStats: (correct: number, attempts: number) => `Aciertos: ${correct} de ${attempts}`,
  dueNow: 'Repasar ahora',
  nextReview: (date: string) => `Próximo repaso: ${date}`,
  groupEmpty: 'Todavía no practicaste conceptos de esta parte.',
  backupHeading: 'Respaldo',
  backupHelp:
    'Descargá un archivo con todo tu progreso para guardarlo o pasarlo a otro navegador. Importarlo reemplaza el progreso de este navegador.',
  exportButton: 'Descargar respaldo',
  exportFailed: 'No pudimos leer tu progreso para armar el respaldo. Probá de nuevo.',
  importLabel: 'Importar un respaldo',
  importSummary: (date: string, attempts: number, concepts: number) =>
    `Respaldo del ${date}: ${count(attempts, 'intento', 'intentos')} y ${count(concepts, 'concepto', 'conceptos')}.`,
  importWarning: (attempts: number) =>
    `Importarlo reemplaza tu progreso actual (${count(attempts, 'intento', 'intentos')}).`,
  importConfirm: 'Reemplazar mi progreso',
  importCancel: 'Cancelar',
  importDone: 'Listo: restauramos tu progreso desde el respaldo.',
  importWriteFailed: 'No pudimos guardar el respaldo importado. Tu progreso actual no cambió.',
  importErrors: {
    'invalid-json': 'El archivo no es un JSON válido.',
    'not-a-backup': 'El archivo no es un respaldo de Al volante.',
    'unsupported-version':
      'El respaldo es de una versión del juego que esta no reconoce. Actualizá la página e intentá de nuevo.',
    'invalid-data': 'El respaldo tiene datos dañados, así que no importamos nada.',
    'too-large': 'El archivo es demasiado grande para ser un respaldo.',
    unreadable: 'No pudimos leer el archivo.',
  },
  unchanged: 'Tu progreso actual no cambió.',
} as const;

const DATE_FORMAT = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' });

/** Numbers as written in Argentina (decimal comma). */
export const formatNumber = (value: number, fractionDigits: number) =>
  new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

export const formatDate = (iso: string) => DATE_FORMAT.format(new Date(iso));
export const formatDateTime = (iso: string) => DATE_TIME_FORMAT.format(new Date(iso));

export const TRACK_COPY = {
  heading: 'Pista de prueba',
  intro:
    'Probá cómo se maneja el auto en un predio cerrado, con un cajón de estacionamiento de 6 m marcado con postes y un cordón. Practicá desde el habitáculo: regulá los espejos, prepará tu posición y probá los mandos. Esta pista todavía no evalúa el examen.',
  transmission: 'Caja de cambios',
  manual: 'Manual',
  automatic: 'Automática',
  controlsHeading: 'Controles',
  controls: {
    common: [
      'Hacé clic en la pista o llegá a ella con Tab para manejar. Estas son las teclas iniciales; podés cambiarlas en «Configurar teclado».',
      'K: llave. Cada vez que la apretás avanza un paso: contacto, arranque, apagado y sacar la llave.',
      'Espacio: poner o sacar el freno de mano.',
      'Flecha arriba o W: acelerar. Flecha abajo o S: frenar.',
      'Flechas izquierda y derecha, o A y D: girar el volante.',
    ],
    manual: [
      'Shift: embrague. Mantenelo para pisarlo; al soltarlo sube despacio, así podés buscar el punto de acople.',
      'E y Q: subir y bajar de marcha (R, N, 1 a 5), siempre con el embrague pisado.',
    ],
    automatic: ['E y Q: mover la palanca (P, R, N, D). Para sacarla de P, pisá el freno.'],
  },
  canvasLabel: 'Vista 3D de la pista de prueba. Usá el teclado para manejar.',
  loading: 'Cargando la pista…',
  unavailable:
    'Tu navegador no puede mostrar gráficos 3D (WebGL), así que la pista no está disponible en este dispositivo.',
  speed: 'Velocidad',
  distance: 'Recorrido',
  engine: 'Motor',
  engineOff: 'Apagado',
  gear: 'Marcha',
  handbrake: 'Freno de mano',
  handbrakeOn: 'Puesto',
  handbrakeOff: 'Sin poner',
  key: 'Llave',
  keyStates: { removed: 'Afuera', off: 'Apagada', on: 'En contacto' },
  events: {
    'engine-started': 'Motor en marcha.',
    'engine-stopped': 'Motor apagado.',
    stall: 'Se caló el motor. Para volver a arrancar, pisá el embrague y accioná la llave.',
    startInGearManual: 'Para arrancar, poné punto muerto (N) o pisá el embrague.',
    startInGearAutomatic: 'Para arrancar, poné la palanca en P o en N.',
    startKey: 'Primero poné la llave en contacto.',
    shiftClutch: 'Para cambiar de marcha, pisá el embrague a fondo.',
    shiftBrake: 'Para sacar la palanca de P, pisá el freno.',
    shiftMoving: 'Con el auto en movimiento no se puede poner esa posición.',
    'moved-with-handbrake': 'Arrancaste con el freno de mano puesto.',
    handbrakeOn: 'Freno de mano puesto.',
    handbrakeOff: 'Freno de mano liberado.',
    'key-removed': 'Sacaste la llave.',
    'key-refused': 'Para sacar la llave, apagá el motor (y en la automática, poné la palanca en P).',
  },
  contact: (what: string) => `Tocaste ${what}. El auto se detuvo.`,
  obstacleNames: { wall: 'una pared', pole: 'un poste del cajón', curb: 'el cordón', cone: 'un cono' },
  reset: 'Volver al inicio',
  homeLink: 'Pista de prueba',
} as const;

export const COCKPIT_COPY = {
  title: 'Al volante',
  subtitle: 'PREDIO DE PRÁCTICA · HABITÁCULO',
  help: 'Enfocá la vista para usar tus teclas. Arrastrá sobre el parabrisas para mirar; también podés usar los botones. Tab permite salir de la vista.',
  setup: 'Prepará tu posición',
  preparationSource: 'Protocolo: comprobaciones previas (PDF 9–10)',
  postureSource: 'Protocolo: postura, espejos y cinturón (PDF 20)',
  instruments: 'Luces e instrumental',
  bindings: 'Configurar teclado',
  bindingHelp:
    'Seleccioná un comando y pulsá una letra, número, flecha, Shift o Espacio. Escape cancela. No se permiten teclas repetidas.',
  waiting: 'Pulsá una tecla…',
  conflict: 'Esa tecla está ocupada o reservada. Probá otra.',
  storageError: 'No se pudo guardar el teclado en este navegador. Los cambios funcionan durante esta sesión.',
  restore: 'Restaurar teclas',
  mirrors: 'Regular espejos',
  mirrorNames: { left: 'Izquierdo', center: 'Interior', right: 'Derecho' },
  horizontal: 'Orientación horizontal',
  vertical: 'Orientación vertical',
  seatDistance: 'Distancia del asiento',
  seatHeight: 'Altura del asiento',
  headrest: 'Altura del apoyacabezas',
  preparation:
    'Regulá asiento, apoyacabezas y espejos; después abrochate. El protocolo pide reconocer y accionar estos mandos (PDF 9–10 y 18–20). Los recorridos de los ajustes son aproximaciones del juego; aquí no se puntúan.',
  actions: {
    throttle: 'Acelerar',
    brake: 'Frenar',
    left: 'Volante a la izquierda',
    right: 'Volante a la derecha',
    clutch: 'Embrague',
    key: 'Accionar llave',
    handbrake: 'Accionar freno de mano',
    gearUp: 'Subir marcha',
    gearDown: 'Bajar marcha',
    lookLeft: 'Mirar a la izquierda',
    lookRight: 'Mirar a la derecha',
    lookBack: 'Mirar hacia atrás',
    lookCenter: 'Mirar al frente',
    glanceLeft: 'Mirar el espejo izquierdo',
    glanceRight: 'Mirar el espejo derecho',
    belt: 'Cinturón',
    lights: 'Cambiar luces',
    signalLeft: 'Giro izquierdo',
    signalRight: 'Giro derecho',
    hazards: 'Balizas',
    wipers: 'Limpiaparabrisas',
    horn: 'Bocina',
  },
  toggles: {
    belt: 'Cinturón',
    hazards: 'Balizas',
    wipers: 'Limpiaparabrisas',
    defogger: 'Desempañador delantero',
    rearHeater: 'Luneta térmica',
    airConditioning: 'Aire acondicionado',
    heating: 'Calefacción',
  },
  lights: 'Iluminación',
  lightNames: { off: 'Apagadas', position: 'Posición', low: 'Bajas', high: 'Altas' },
  beltOn: 'Cinturón abrochado',
  beltOff: 'Cinturón sin abrochar',
  on: 'Activado',
  off: 'Desactivado',
  hornActive: 'Bocina activada (representación visual)',
  climateNote:
    'Los testigos indican qué equipo activaste. Esta pista tiene tiempo seco: no simula lluvia ni empañamiento.',
  pedals: 'Pedalera y caja',
  look: 'Observación',
  speed: 'km/h',
  rpm: 'rpm',
} as const;

export const EXAM_COPY = {
  heading: 'Examen práctico: etapa I y primera cuadra',
  intro:
    'Un examinador virtual te guía por las comprobaciones previas, los 30 cm hacia atrás y hacia adelante, la salida del cajón, los primeros 100 m por Quesada y el cruce con semáforo de Av. Cabildo, con las fallas del protocolo oficial. El resto del circuito llega en la fase 4.',
  transmission: 'Caja de cambios',
  manual: 'Manual',
  automatic: 'Automática',
  seed: 'Orden de las preguntas (semilla)',
  canvasLabel: 'Vista 3D del examen en el cajón. Usá el teclado para manejar.',
  loading: 'Cargando el examen…',
  unavailable:
    'Tu navegador no puede mostrar gráficos 3D (WebGL), así que el examen práctico no está disponible en este dispositivo.',
  examiner: 'Examinador/a',
  ready: 'Listo, sigamos',
  requestStop: 'Pedir que se interrumpa el examen',
  restart: 'Empezar de nuevo',
  phases: {
    familiarisation:
      'Antes de empezar te muestro los mandos: luces, instrumental, pedalera y caja. Probá lo que quieras; nada de esto cuenta. Avisame cuando quieras empezar.',
    recognition: 'Te voy a pedir los mandos de a uno.',
    preparation:
      'Regulá el asiento, el apoyacabezas y los espejos, y abrochate el cinturón. Dejá las luces bajas encendidas. Avisame cuando termines.',
    unlock: 'Verificá que la caja esté sin cambio (N, o P en la automática) y arrancá el motor.',
    reverse: 'Retrocedé 30 cm sin mover el volante.',
    reverseManual: 'Solo con el embrague: sin acelerador ni freno (podés frenar al final).',
    reverseAutomatic: 'Regulá solo con el freno.',
    forward: 'Ahora avanzá 30 cm, sin girar el volante y en una sola maniobra.',
    forwardManual: 'En primera.',
    forwardAutomatic: 'En D.',
    exit: 'Salí del cajón hacia la calle, a tu izquierda: direccional, espejos y una salida fluida.',
    firstMetres: 'Primeros 100 m: a no más de 30 km/h. Te aviso cuando terminen.',
    firstMetresManual: 'En segunda.',
    firstMetresAutomatic: 'En D.',
    approach:
      'Terminaron los 100 m. En la esquina doblá a la derecha, por Av. Cabildo: direccional 30 m antes, respetá el semáforo, la línea de detención y la senda peatonal.',
    turn: 'Doblá a la derecha y seguí por la avenida.',
    finished: 'Esta parte del examen terminó.',
  },
  prompts: {
    clutch: 'Pisá el embrague.',
    brake: 'Pisá el freno.',
    throttle: 'Pisá el acelerador.',
    'gear-1': 'Poné primera.',
    'gear-2': 'Poné segunda.',
    'gear-3': 'Poné tercera.',
    'gear-4': 'Poné cuarta.',
    'gear-5': 'Poné quinta.',
    'gear-R': 'Poné reversa.',
    'gear-N': 'Poné punto muerto (N).',
    'gear-P': 'Poné la palanca en P.',
    'gear-D': 'Poné la palanca en D.',
    position: 'Encendé las luces de posición.',
    low: 'Encendé las luces bajas.',
    high: 'Encendé las luces altas.',
    'signal-left': 'Accioná la direccional izquierda.',
    'signal-right': 'Accioná la direccional derecha.',
    hazards: 'Accioná las balizas.',
    wipers: 'Accioná el limpiaparabrisas.',
    defogger: 'Accioná el desempañador.',
    horn: 'Tocá la bocina.',
    rearHeater: 'Accioná la luneta térmica.',
    airConditioning: 'Accioná el aire acondicionado.',
  },
  gearHintManual: 'Con el embrague pisado a fondo.',
  gearHintAutomatic: 'Con el freno pisado para salir de P.',
  points: 'Puntos',
  faults: 'Fallas registradas',
  noFaults: 'Sin fallas por ahora.',
  faultPoints: (points: number) => `${points} ${points === 1 ? 'punto' : 'puntos'}`,
  escalated: 'escalada a eliminatoria por intervención del examinador',
  repetition: {
    once: 'se cuenta una vez',
    'single-check': 'control único',
    'per-occurrence': 'se cuenta cada vez',
    'per-episode': 'una por episodio',
    unspecified: 'una por episodio (decisión D3)',
  },
  interrupted: 'El examen se interrumpió.',
  interruptionCauses: {
    fault: 'Falla eliminatoria que interrumpe el examen.',
    cutoff: 'Con 8 puntos o más no se sale a circular (protocolo, PDF 10).',
    'driver-request': 'Pediste interrumpir el examen: queda desaprobado (protocolo, PDF 8).',
    examiner: 'El examinador tomó el control.',
  },
  results: {
    approved: 'Aprobado',
    disapproved: 'Desaprobado',
    pending: 'Resultado parcial: faltan la circulación y el estacionamiento.',
  },
  overPoints: 'con 8 puntos o más el examen está desaprobado (protocolo, PDF 14).',
  measurements: 'Mediciones',
  reverseCm: 'Retroceso',
  forwardCm: 'Avance',
  exitManoeuvres: 'Maniobras de salida',
  firstMetresTopKmh: 'Máxima en los primeros 100 m',
  light: 'Semáforo',
  lightStates: { green: 'Verde', yellow: 'Amarillo', red: 'Rojo' },
  pendingMeasure: 'pendiente',
  feedback: 'Devolución',
  feedbackIntro: 'Cada falla cita la conducta de la ficha, qué evalúa el protocolo y las páginas para repasar.',
  feedbackClean:
    'Sin fallas en esta parte. Repasá igual las páginas del protocolo sobre la salida del cajón y los primeros 100 m (PDF 11 y 31).',
  whatIsEvaluated: 'Qué evalúa',
  readMore: 'Repasar en el protocolo',
  protocolPage: (page: number) => `PDF ${page}`,
  approximations:
    'Aproximaciones del juego, no reglas del protocolo: tolerancia de ±10 cm en los 30 cm (V2); un poste tocado a menos de 1 m/s es un roce y a más, un derribo; chequear los espejos se registra al mirar un espejo lateral (un giro corto de la cabeza, D4); girar del todo la cabeza no lo reemplaza (X6); el cordón tocado a menos de 1 m/s es un roce de la rueda y a más, subirse a la vereda; en manual, frenar durante los 30 cm solo vale al final; los límites de velocidad se juzgan con 1 km/h de margen; en los primeros 100 m, la marcha se exige por encima de 15 km/h; bloquear el cruce se cuenta tras 2 s detenido en rojo. Ver REGLAS.md §7.',
  source: 'Protocolo: etapa I (PDF 9–10), maniobrabilidad y salida del cajón (PDF 11), puntaje (PDF 14).',
  homeLink: 'Examen práctico',
} as const;
export const CITY_COPY = {
  drivingSubtitle: 'COMUNA 13 · HABITÁCULO',
  mapScale: '100 m',
  heading: 'Recorrido A · Comuna 13',
  eyebrow: 'NÚÑEZ / BUENOS AIRES',
  intro: 'Conocé las calles, ubicá los cruces y recorré el barrio desde el habitáculo.',
  homeLink: 'Explorar Comuna 13',
  mapLabel: 'Mapa del recorrido A, con el norte hacia arriba',
  north: 'N',
  route: 'El recorrido',
  length: 'de circuito',
  legs: 'tramos conectados',
  selectLeg: 'Punto de entrada',
  leg: (number: number, street: string) => `${number}. ${street}`,
  overview: 'Explorar el barrio',
  drive: 'Conducir este tramo',
  whole: 'Ver circuito completo',
  block: 'Ver esta cuadra',
  reset: 'Volver al punto de entrada',
  loading: 'Construyendo el barrio…',
  canvasLabel: 'Vista tridimensional del recorrido A',
  unavailable: 'No se pudo iniciar la vista 3D. Podés consultar el mapa y las fuentes del recorrido.',
  scope:
    'Exploración del trazado: los semáforos están apagados y todavía no hay tránsito ni evaluación del examen completo.',
  approximation:
    'Anchos, veredas, fachadas y posición de entrada son aproximaciones. PARE, carriles y máximas viales conservan la evidencia de OSM; falta un relevamiento en calle. No uses esta escena como guía de circulación actual.',
  sources: 'Fuentes y verificación',
  official: 'Lámina oficial · recorridos, página 16',
  protocol: 'Protocolo · página 39',
  attribution:
    '© OpenStreetMap contributors · ODbL. Semáforos: Gobierno de la Ciudad Autónoma de Buenos Aires · CC-BY 2.5 AR.',
  sourceMap: 'Ver atribución de OpenStreetMap',
  sourceSignals: 'Consultar cruces semaforizados del GCBA',
  pending:
    'Cabildo y Guayra: se representa el semáforo informado por el GCBA; la discrepancia con OSM sigue pendiente de verificación en calle.',
  controlNames: {
    stop: 'PARE',
    traffic_signals: 'Semáforo',
    'crossing-traffic_signals': 'Senda semaforizada',
    'traffic-calming-hump': 'Reductor',
  } as Record<string, string>,
  statusNames: {
    'single-source': 'Una fuente',
    'sources-verified': 'Fuentes coincidentes',
    discrepancy: 'Discrepancia pendiente',
    approximation: 'Aproximación',
    surveyed: 'Relevado',
  } as Record<string, string>,
  stop: 'PARE',
  nextLeft: 'Al final, doblá a la izquierda.',
  nextRight: 'Al final, doblá a la derecha.',
};
