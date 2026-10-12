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
  mapPractical: 'Examen práctico: protocolo y recorridos',
  unitsCount: 'unidades',
  unitsWithActivities: 'con actividades',
  unitsForConsultation: 'de consulta',
  sectionPractice: 'Practicá esta sección',
  sectionPracticeCount: 'actividades sobre esta sección',
  sectionNoActivities: 'Esta sección todavía no tiene actividades.',
  unitPracticedIn: 'Practicala en',
  unitConsultation: 'Material de consulta',
  sectionUnitsHeading: 'Unidades de conocimiento',
  sectionPages: 'Páginas',
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
  protocolo: {
    front: 'Tapa e índice',
    general: 'Presentación y condiciones del examen',
    stages: 'Las tres etapas del examen',
    evaluation: 'Forma de evaluación y ficha',
    annex1: 'Anexo I · Gráficos de la preparación y del cajón',
    annex2: 'Anexo II · Las fallas y cómo se evalúan',
    annex3: 'Anexo III · Circuitos de examen (2023)',
    back: 'Contratapa',
  },
  recorridos: {
    front: 'Tapa, autoridades e índice',
    intro: 'Presentación',
    circuits: 'Circuitos de examen por comuna',
    back: 'Contratapa',
  },
};

export const CATEGORY_LABELS: Record<string, string> = {
  B: 'Licencia B',
  common: 'Consulta general',
  D: 'Complementario: transporte de pasajeros/as',
  'C-E': 'Complementario: transporte de carga',
  guide: 'Guía de siniestros',
  exam: 'Examen práctico (consulta)',
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

export const THEORY_COPY = {
  heading: 'Sala de examen',
  introHeading: 'Simulacro del examen teórico',
  introSummary: (questions: number, pass: number, options: number, minutes: number) =>
    `${questions} preguntas de opción múltiple con ${options} opciones y una sola correcta, tomadas de todo el material de la licencia B y repartidas por tema. Aprobás con ${pass} correctas. Tenés ${minutes} minutos.`,
  notOfficial:
    'Es un simulacro propio, armado con las actividades revisadas del juego: no es el banco oficial. La cantidad de preguntas, el puntaje y el tiempo siguen las fuentes citadas abajo, que no coinciden en el tiempo: 45 minutos según la disposición de 2023 y 40 según el informe de gestión de 2024.',
  timeLegend: 'Tiempo',
  timeDefault: (minutes: number) => `${minutes} minutos (Disposición 860/2023)`,
  timeShort: (minutes: number) => `${minutes} minutos (informe de gestión 2024, más exigente)`,
  shortBank: (available: number, questions: number) =>
    `Por ahora hay ${available} preguntas disponibles de las ${questions} del examen: este simulacro no puede aprobarse.`,
  start: 'Empezar el simulacro',
  another: 'Otro simulacro',
  sourcesHeading: 'Fuentes de los parámetros',
  runningHeading: 'Respondé las preguntas',
  timeLeft: 'Tiempo restante',
  progress: (answered: number, total: number) => `Respondiste ${answered} de ${total}`,
  signLabel: 'Señal',
  handIn: 'Entregar',
  passed: 'Aprobado',
  failed: 'No aprobado',
  score: (correct: number, total: number, pass: number) =>
    `${correct} de ${total} respuestas correctas (se necesitan ${pass}).`,
  timedOut: 'Se terminó el tiempo: el examen se entregó solo.',
  unanswered: (count: number) => `Sin responder: ${count} (cuentan como incorrectas).`,
  notSaved: 'No pudimos guardar este simulacro en tu bitácora; el resto de tu progreso está intacto.',
  bySectionHeading: 'Resultado por tema',
  sectionColumn: 'Tema',
  correctColumn: 'Correctas',
  reviewHeading: 'Para repasar',
  wrongHeading: 'Preguntas que fallaste',
  notAnswered: 'No la respondiste.',
  yourAnswer: 'Tu respuesta',
  rightAnswer: 'Respuesta correcta',
  practise: 'Practicar esta actividad',
  logbookHeading: 'Simulacros del teórico',
  logbookEmpty: 'Todavía no hiciste ningún simulacro.',
  logbookRow: (correct: number, total: number, passed: boolean) =>
    `${correct} de ${total} · ${passed ? 'Aprobado' : 'No aprobado'}`,
} as const;

export const GARAGE_COPY = {
  heading: 'Mi garaje',
  intro:
    'Conocé tu auto antes de salir: revisá sus elementos de seguridad y practicá la preparación al volante, como en la primera etapa del examen.',
  cockpitHeading: 'Al volante',
  cockpitIntro:
    'Sentate en el habitáculo: regulá el asiento, el apoyacabezas y los espejos, abrochate el cinturón y reconocé el instrumental.',
  stageOne: 'Practicar la etapa I del examen',
  yard: 'Pista de prueba',
  inspectionHeading: 'Revisión del auto',
  inspectionIntro:
    'Frenos, neumáticos, luces, espejos, cinturones, sillitas para chicos y los elementos de seguridad que tenés que llevar (manual, anexo I).',
  noActivities: 'Todavía no hay actividades de revisión del auto.',
  studyAnnex: 'Estudiar el anexo I · Automóviles particulares',
} as const;

export const SIGN_COPY = {
  heading: 'Catálogo de señales',
  intro:
    'Todas las señales del manual, como aparecen en sus páginas: reglamentarias, preventivas, informativas, transitorias, marcas en la calzada y semáforos. Cada una enlaza a su página y a la actividad donde se practica.',
  libraryLink: 'Catálogo de señales',
  libraryLinkHint: 'todas las señales del manual, con su imagen',
  consultation: 'Para consulta',
  page: 'Página',
  practise: 'Practicar',
} as const;

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
    description: 'Resolvé escenas y preguntas sobre el material de estudio, sección por sección.',
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
    'Escenas y preguntas para practicar lo que estudiás, sección por sección. Cada respuesta explica el porqué y cita la página del material oficial. El mapa de aprendizaje muestra qué parte de cada sección ya tiene actividades.',
  sectionIntro:
    'Elegí una actividad. Las variantes cambian en cada intento, así que no alcanza con memorizar una respuesta.',
  allSections: 'Todas las secciones',
  studySection: 'Estudiar esta sección',
  unknownSection: 'Esa sección no existe o todavía no tiene actividades. Elegí una de la lista.',
  activityOne: 'actividad',
  activityMany: 'actividades',
  unitsInSection: 'unidades en la sección',
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
  drivingHeading: 'Manejos registrados',
  drivingEmpty: 'Todavía no registraste ningún recorrido ni examen práctico.',
  drivingLink: 'Ir al examen práctico',
  drivingModes: { learn: 'Aprender', practice: 'Práctica', review: 'Repaso', run: 'Recorrido', exam: 'Examen' },
  drivingStages: (stages: readonly string[]) =>
    stages.length === 0 ? 'ninguna etapa completa' : `etapas completas: ${stages.join(', ')}`,
  drivingPoints: (points: number | null) =>
    points === null ? 'sin puntaje' : `${points} ${points === 1 ? 'punto' : 'puntos'}`,
  drivingResults: { approved: 'Aprobado', disapproved: 'Desaprobado', pending: 'Pendiente' },
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
  obstacleNames: {
    wall: 'una pared',
    pole: 'un poste del cajón',
    curb: 'el cordón',
    cone: 'un cono',
    vehicle: 'un auto estacionado',
  },
  reset: 'Volver al inicio',
  homeLink: 'Pista de prueba',
} as const;

export const COCKPIT_COPY = {
  fullscreen: 'Pantalla completa',
  exitFullscreen: 'Salir de pantalla completa',
  fullscreenUnavailable: 'Este navegador no pudo abrir la pantalla completa. Podés seguir manejando en esta vista.',
  instrumentRpmScale: '×1000',
  title: 'Al volante',
  subtitle: 'PREDIO DE PRÁCTICA · HABITÁCULO',
  help: 'Enfocá la vista para usar tus teclas. Arrastrá sobre el parabrisas para mirar; también podés usar los botones. Tab permite salir de la vista. Con teclas, el giro se dosifica según la velocidad.',
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
    door: 'Abrir la puerta y bajar',
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
  heading: 'Examen práctico completo por Comuna 13',
  intro:
    'Un examinador virtual te guía por las tres etapas: las comprobaciones previas, los 30 cm hacia atrás y hacia adelante, la salida del cajón, los primeros 100 m por Quesada, la circulación completa del recorrido A con tránsito y semáforos según la semilla, y al volver a Quesada el estacionamiento paralelo en el cajón, la posición final, el apagado y el descenso, con las fallas del protocolo que el juego puede medir; las que no (por ejemplo, el celular o las indicaciones de un agente de tránsito) se listan en las aproximaciones del juego.',
  transmission: 'Caja de cambios',
  manual: 'Manual',
  automatic: 'Automática',
  seed: 'Semilla (preguntas y tránsito)',
  canvasLabel: 'Vista 3D del examen por Comuna 13. Usá el teclado para manejar.',
  canvasSubtitle: 'COMUNA 13 · EXAMEN',
  loading: 'Cargando el examen…',
  unavailable:
    'Tu navegador no puede mostrar gráficos 3D (WebGL), así que el examen práctico no está disponible en este dispositivo.',
  examiner: 'Examinador/a',
  ready: 'Listo, sigamos',
  parkingDone: 'Terminé de estacionar',
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
    circulation:
      'Terminaron los 100 m. Seguí el recorrido: respetá los semáforos, el PARE, las prioridades, las sendas y los límites de velocidad. Te voy indicando cada giro.',
    parking:
      'Vamos a estacionar en el cajón de la derecha. Balizas al menos 3 s antes de detenerte en doble fila junto al cajón, mirá los espejos, entrá marcha atrás y quedá centrado, paralelo y a unos 20 cm del cordón. Hasta 3 maniobras y 2 intentos. Cuando termines, con el auto detenido, avisame.',
    leaving:
      'Terminamos. Dejá la caja en punto muerto (N; P en la automática), poné el freno de mano, apagá las luces bajas y el motor, sacá la llave, mirá el espejo izquierdo y recién entonces abrí la puerta para bajar.',
    finished: 'El examen terminó.',
  },
  /** The examiner's notice before the bay (protocolo PDF 24: 100 m before). */
  parkingNotice: (distanceM: number) =>
    `Vamos a estacionar: el cajón está a ${Math.round(distanceM)} m, sobre Quesada, a la derecha.`,
  parkingDoneHint: 'Avisá con el auto detenido.',
  /** The next turn, announced on entering each leg (protocolo PDF 12: the turn is signalled 30 m before). */
  instruction: (turn: 'left' | 'right', street: string) =>
    `En la próxima esquina, doblá a la ${turn === 'left' ? 'izquierda' : 'derecha'}, por ${street}.`,
  leg: (number: number, street: string) => `Tramo ${number} · ${street}`,
  currentLeg: 'Tramo',
  nextInstruction: 'Próxima indicación',
  notice: 'Adelante',
  notices: {
    signal: (distanceM: number) => `Semáforo a ${Math.round(distanceM)} m.`,
    stop: (distanceM: number) => `PARE a ${Math.round(distanceM)} m: detención completa antes de la línea.`,
    priority: (distanceM: number) => `Esquina sin semáforo a ${Math.round(distanceM)} m: reducí y mirá a tu derecha.`,
    bump: (distanceM: number) => `Lomo de burro a ${Math.round(distanceM)} m.`,
    emergency: () => 'Vehículo de emergencia con sirena: hacele lugar a la derecha o detenete.',
  },
  nothingAhead: 'nada por ahora',
  limits: 'Velocidad',
  limitsOf: (examKmh: number, postedKmh: number | null) =>
    `${examKmh} km/h de examen · máxima de la vía ${postedKmh === null ? 'sin dato' : `${postedKmh} km/h`} (OSM, sin confirmar)`,
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
    examiner: 'El examinador tomó el control con el doble comando (protocolo, PDF 7).',
  },
  interruptedBy: (rule: string) => `Motivo: ${rule}.`,
  takeover: 'El examinador frenó el auto.',
  results: {
    approved: 'Aprobado',
    disapproved: 'Desaprobado',
    pending: 'Resultado parcial: el examen terminó sin completar las tres etapas.',
  },
  approvedWith: (points: number) => `con ${points} ${points === 1 ? 'punto' : 'puntos'} (protocolo, PDF 14).`,
  overPoints: 'con 8 puntos o más el examen está desaprobado (protocolo, PDF 14).',
  measurements: 'Mediciones',
  reverseCm: 'Retroceso',
  forwardCm: 'Avance',
  exitManoeuvres: 'Maniobras de salida',
  firstMetresTopKmh: 'Máxima en los primeros 100 m',
  parkingCounters: 'Estacionamiento',
  parkingCountersOf: (manoeuvres: number, attempts: number) =>
    `${manoeuvres} ${manoeuvres === 1 ? 'maniobra' : 'maniobras'} · ${attempts} ${attempts === 1 ? 'intento' : 'intentos'}`,
  kerbDistance: 'Distancia al cordón',
  kerbDistanceOf: (frontCm: number, rearCm: number) =>
    `adelante ${Math.round(frontCm)} cm · atrás ${Math.round(rearCm)} cm`,
  bayAhead: (distanceM: number) => `cajón a ${Math.round(distanceM)} m`,
  descentChecklist: 'Para bajar',
  descentSteps: {
    neutral: 'N',
    park: 'P',
    handbrake: 'freno de mano',
    lightsOff: 'luces apagadas',
    engineOff: 'motor apagado',
    keyOut: 'llave afuera',
    mirror: 'espejo izquierdo',
  },
  light: 'Semáforo',
  lightStates: { green: 'Verde', yellow: 'Amarillo', red: 'Rojo' },
  pendingMeasure: 'pendiente',
  noSignalAhead: 'sin semáforo cerca',
  feedback: 'Devolución',
  feedbackIntro: 'Cada falla cita la conducta de la ficha, qué evalúa el protocolo y las páginas para repasar.',
  feedbackClean:
    'Sin fallas. Repasá igual las páginas del protocolo sobre la salida del cajón, los primeros 100 m, la circulación y el estacionamiento (PDF 11, 12, 13 y 31).',
  whatIsEvaluated: 'Qué evalúa',
  readMore: 'Repasar en el protocolo',
  protocolPage: (page: number) => `PDF ${page}`,
  approximations:
    'Aproximaciones del juego, no reglas del protocolo: tolerancia de ±10 cm en los 30 cm (V2); un poste tocado a menos de 1 m/s es un roce y a más, un derribo; chequear los espejos se registra al mirar un espejo lateral (un giro corto de la cabeza, D4); girar del todo la cabeza no lo reemplaza (X6); el cordón tocado a menos de 1 m/s es un roce de la rueda y a más, subirse a la vereda; en manual, frenar durante los 30 cm solo vale al final; los límites de velocidad se juzgan con 1 km/h de margen; en los primeros 100 m, la marcha se exige por encima de 15 km/h. En la circulación: distancia de 2 s medida contra el vehículo de adelante en movimiento durante más de 1,5 s; reducir antes de girar o de un cruce sin semáforo es ir a 20 km/h o menos a 12 m; el PARE exige detenerse del todo a menos de 3 m de la línea; bloquear el cruce es estar 2 s parado sobre la calzada cruzada; la velocidad precautoria se exige a 20 km/h o menos a 15 m de una senda con peatones; el lomo de burro se pasa a 20 km/h o menos; la mínima es 10 km/h durante 8 s con la vía libre; una detención innecesaria es 1 s parado sin nada a menos de 8 m; la pérdida de control es una aceleración lateral mayor a 6 m/s²; el examinador toma el control cuando frenar ya no alcanza (más de 7 m/s²) para evitar a alguien de frente; al vehículo de emergencia se le cede el paso bajando a 10 km/h o corriéndose 0,7 m a la derecha mientras está a menos de 30 m detrás, hasta que pasa. En el estacionamiento: la primera detención, que alinea el auto en doble fila, cuenta entre 8 m antes y 12 m después del centro del cajón, con el centro del auto a no más de 5 m a la izquierda de la línea del cajón; una maniobra es cada cambio de sentido desde la primera marcha atrás; un intento nuevo es volver a la doble fila (1,2 m o más a la izquierda de la línea del cajón) después de haber entrado al cajón; las líneas pintadas hacen de vallas (tocarlas a menos de 1 m/s es un roce; a más, un golpe); centrado es quedar a menos de 0,5 m del centro del cajón; 50 cm exactos del cordón es la segunda franja (V1); bloquear la dirección es sacar la llave con el motor apagado. No se evalúan las dos manos en el volante, el uso de celular ni la autoridad de tránsito. Ver REGLAS.md §7 y §9.',
  source:
    'Protocolo: etapa I (PDF 9–10), maniobrabilidad y salida del cajón (PDF 11), circulación (PDF 12), estacionamiento y descenso (PDF 13, 21), puntaje (PDF 14), anexo II (PDF 22–33). Máximas de la vía: OpenStreetMap, sin relevamiento en calle.',
  homeLink: 'Examen práctico',
  /** Modes of the exam page (F04-T05; REGLAS.md §7, D15). */
  mode: 'Modo',
  modes: { learn: 'Aprender', practice: 'Practicar', run: 'Recorrer', exam: 'Rendir' },
  modeHelp: {
    learn:
      'Guiado: además del paso a paso con las teclas, en cada fase ves qué regla se evalúa y con qué umbral, y cada falla se explica en el momento. Lo que hagas acá no se guarda en la bitácora.',
    practice:
      'Una sola etapa, con el paso a paso y todas las ayudas del tablero. El resultado queda pendiente: no es un examen completo.',
    run: 'Las tres etapas seguidas con el paso a paso, las ayudas del tablero y el puntaje a la vista. Se guarda en la bitácora.',
    exam: 'Como el examen real: solo lo que dice el examinador, sin paso a paso (las teclas siguen a la vista). Puntos, fallas y ficha recién al final. Se guarda en la bitácora.',
  },
  stage: 'Etapa a practicar',
  stageNames: { I: 'Etapa I', II: 'Etapa II', III: 'Etapa III' },
  stageTitles: {
    I: 'Etapa I · reconocimiento y preparación',
    II: 'Etapa II · 30 cm, salida del cajón y circulación',
    III: 'Etapa III · estacionamiento y descenso',
  },
  practiceStart: {
    I: 'Practicás la etapa I completa; termina cuando avisás que estás listo/a para salir.',
    II: 'Empezás en el cajón con el motor apagado y la llave puesta; termina al volver a Quesada tras los ocho tramos.',
    III: 'Empezás sobre Vuelta de Obligado (tramo 8) con el motor en marcha, antes del aviso de los 100 m; termina al bajar del auto.',
  },
  examNoAids: 'Modo rendir: los puntos y las fallas se informan al final, como en el examen real (protocolo, PDF 14).',
  /** Guided learning (mode "aprender"): what each phase checks, in plain words; what to do is the driving guide. */
  learnChecks: 'Qué se evalúa ahora',
  learnHints: {
    familiarisation: {
      checks: 'Nada todavía: podés probar todos los mandos sin consecuencias.',
    },
    recognition: {
      checks:
        'Pedales y caja: no reconocerlos es eliminatorio (8 puntos). Luces e instrumentos: 1 punto cada familia, una sola vez. Un mando de otra familia no cuenta como respuesta.',
    },
    preparation: {
      checks:
        'Al avisar que estás listo/a: asiento y apoyacabezas sin regular, 1 punto cada uno; no chequear los tres espejos, 3 puntos. Con 8 puntos o más antes de salir, el examen se interrumpe.',
    },
    unlock: {
      checks:
        'Arrancar con un cambio puesto (o sin verificar el punto muerto) es 1 punto; arrancar con el motor ya en marcha, 1 punto por vez.',
    },
    reverse: {
      checks:
        'Retroceder 30 cm (±10 cm, aproximación del juego) sin mover el volante, en una sola maniobra y con la técnica pedida: 3 puntos si falla.',
    },
    forward: {
      checks:
        'Avanzar 30 cm (±10 cm) sin girar el volante y en una sola maniobra, en primera o en D: 3 puntos si falla.',
    },
    exit: {
      checks:
        'Al arrancar: sin direccional izquierda, 1 punto; sin mirar los espejos, 3 puntos. Sin cinturón al moverte, eliminatorio. Tocar un poste despacio son 3 puntos; derribarlo (a 1 m/s o más), eliminatorio.',
    },
    firstMetres: {
      checks:
        'Primeros 100 m: más de 30 km/h, o por encima de 15 km/h sin estar en segunda (D en la automática), es eliminatorio (indicación de marcha). Las reglas de la esquina rigen igual.',
    },
    circulation: {
      checks:
        'Semáforo en rojo, carriles exclusivos, línea continua, sobrepasos indebidos, emergencia sin ceder: eliminatorios. Velocidad: más de 30 km/h (45 en Cabildo) son 3 puntos; más que la máxima de la vía, eliminatorio. Esquinas: PARE sin detención, prioridad, reducir, carril de giro, sendas con peatones: 3 puntos. Direccional ausente, 2 puntos; a menos de 30 m, 1 punto.',
    },
    parking: {
      checks:
        'Balizas 3 s o más antes de parar en doble fila: si no, 2 puntos. Espejos antes de retroceder: 3 puntos si no. Cuarta maniobra: 1 punto. Tercer intento: eliminatorio. Pisar una línea del cajón despacio, 3 puntos; a 1 m/s o más, eliminatorio. Posición final: menos de 15 cm, 1 punto; entre 25 y 50 cm, 1 punto; más de 50 cm, eliminatorio; inclinada o descentrada más de 0,5 m, 1 punto.',
    },
    leaving: {
      checks:
        'Al abrir la puerta: caja fuera de N (P en la automática), sin freno de mano, luces bajas encendidas, motor en marcha o llave puesta: 1 punto cada una. Sin mirar el espejo izquierdo: 2 puntos.',
    },
    finished: {
      checks: 'El examen terminó: revisá la ficha.',
    },
  },
  lastFault: 'Última falla',
  /** The card per stage (F04-T05). */
  card: 'Ficha por etapa',
  cardIntro:
    'Una sección por etapa, como la ficha del protocolo (PDF 15–17): fallas con su regla, puntos, momento y condición evaluada, y el total.',
  stageCompleted: 'completada',
  stageIncomplete: 'incompleta',
  stageOutOfScope: 'no se rindió en este modo',
  stageDuration: (seconds: number) => `${formatNumber(seconds, 0)} s`,
  faultAt: (seconds: number) => `a los ${formatNumber(seconds, 0)} s`,
  subtotal: (points: number) => `Subtotal: ${points} ${points === 1 ? 'punto' : 'puntos'}`,
  total: (points: number) => `Total: ${points} ${points === 1 ? 'punto' : 'puntos'}`,
  verdicts: {
    approved: (points: number) =>
      `Aprobado con ${points} ${points === 1 ? 'punto' : 'puntos'}: tres etapas completas y 7 puntos o menos (protocolo, PDF 14).`,
    interruption: 'Desaprobado: el examen se interrumpió.',
    eliminatory: (rule: string) =>
      `Desaprobado por una falla eliminatoria que no interrumpe: ${rule} (protocolo, PDF 32–33).`,
    overPoints: (points: number) =>
      `Desaprobado: ${points} puntos; con 8 o más el examen está desaprobado (protocolo, PDF 14).`,
    pending: 'Resultado pendiente: no se rindieron las tres etapas completas, así que no hay aprobado ni desaprobado.',
  },
  approximationsHeading: 'Aproximaciones del juego que pudieron influir',
  saved: 'Este intento quedó guardado en tu bitácora.',
  saveFailed: 'No pudimos guardar este intento en la bitácora; el resto de tu progreso está intacto.',
  notSaved: 'El modo aprender no se guarda en la bitácora.',
  homeModes: {
    learn: 'Aprender el examen',
    practice: 'Practicar una etapa',
    run: 'Recorrer las tres etapas',
    exam: 'Rendir el examen',
  },
  homeDriving: 'Al volante',
  homeDrivingIntro: 'Pista de prueba, recorrido libre y el examen práctico en sus cuatro modos.',
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
    'Exploración con tránsito: autos, colectivos, bicis y peatones circulan según la semilla y los semáforos tienen ciclo. La evaluación del circuito completo llega en las próximas tareas; acá no se puntúa nada.',
  seed: 'Semilla del tránsito',
  seedHelp: 'La misma semilla repite el mismo tránsito y los mismos ciclos de semáforo.',
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

export const AUDIO_COPY = {
  title: 'Sonido de conducción',
  muted: 'Audio silenciado.',
  mute: 'Silenciar',
  unmute: 'Activar sonido',
  volume: 'Volumen',
  waiting: 'El sonido se activa al usar los controles.',
  running: 'Audio de motor y tránsito activo.',
  unavailable: 'No se pudo activar el audio. Podés seguir manejando y volver a intentarlo.',
  storageError: 'El volumen funciona, pero no se pudo guardar la preferencia.',
} as const;

export const NEIGHBORHOOD_COPY = {
  shops: ['ALMACÉN', 'CAFÉ', 'PANADERÍA', 'KIOSCO', 'VERDULERÍA', 'ÓPTICA', 'LIBRERÍA', 'CAFÉ'],
} as const;
