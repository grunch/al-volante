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
    'Probá cómo se mueve el auto en un predio cerrado, con un cajón de estacionamiento de 6 m marcado con postes y un cordón. Es un banco de pruebas de la simulación: el habitáculo, la caja de cambios y los controles configurables llegan en las próximas tareas.',
  controlsHeading: 'Controles',
  controls: [
    'Hacé clic en la pista o llegá a ella con Tab para manejar.',
    'Flecha arriba o W: acelerar.',
    'Flecha abajo o S: frenar.',
    'Flechas izquierda y derecha, o A y D: girar el volante.',
    'R: cambiar entre marcha adelante y marcha atrás.',
  ],
  canvasLabel: 'Vista 3D de la pista de prueba. Usá las flechas para manejar.',
  loading: 'Cargando la pista…',
  unavailable:
    'Tu navegador no puede mostrar gráficos 3D (WebGL), así que la pista no está disponible en este dispositivo.',
  speed: 'Velocidad',
  distance: 'Recorrido',
  direction: 'Sentido',
  forward: 'Adelante',
  backward: 'Marcha atrás',
  contact: (what: string) => `Tocaste ${what}. El auto se detuvo.`,
  obstacleNames: { wall: 'una pared', pole: 'un poste del cajón', curb: 'el cordón', cone: 'un cono' },
  reset: 'Volver al inicio',
  homeLink: 'Pista de prueba',
} as const;
