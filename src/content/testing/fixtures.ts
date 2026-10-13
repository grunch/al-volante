import type {
  Activity,
  KnowledgeUnit,
  Page,
  Route,
  RouteLeg,
  Rule,
  RuleCatalog,
  Sign,
  Source,
  TheoryExamConfig,
} from '../schemas.ts';

/** Minimal, valid fixtures; tests clone and break them one property at a time. */
export function source(id: Source['id'], pages: number): Source {
  return {
    id,
    title: id,
    edition: '2023',
    path: `pdf/${id}.pdf`,
    originalFilename: `${id}.pdf`,
    pages,
    sha256: 'a'.repeat(64),
    extractedText: `${id}.txt`,
    provenance: { url: 'https://example.org/source.pdf', retrievedAt: '2026-10-11', sha256Verified: true },
  };
}

export function page(overrides: Partial<Page> & Pick<Page, 'source' | 'page'>): Page {
  return {
    printedPage: null,
    section: 'front',
    category: 'common',
    kind: 'cover',
    summary: 'Tapa',
    units: [],
    figures: [],
    notes: '',
    ...overrides,
  };
}

export function unit(overrides: Partial<KnowledgeUnit> & Pick<KnowledgeUnit, 'id'>): KnowledgeUnit {
  return {
    source: 'manual',
    section: 'ch3',
    pages: [2],
    title: 'Rotonda',
    category: 'B',
    type: 'rule',
    summary: 'Prioridad en rotonda.',
    keyFacts: [],
    figureBased: false,
    status: 'transcribed',
    notes: '',
    ...overrides,
  };
}

export function sign(overrides: Partial<Sign> & Pick<Sign, 'id'>): Sign {
  return {
    page: 2,
    group: 'Reglamentarias',
    name: 'Contramano',
    meaning: '',
    visual: 'Círculo rojo',
    printedCode: null,
    status: 'transcribed',
    notes: '',
    ...overrides,
  };
}

/** One page record per page of an exam document: every source is classified page by page since F05-T04. */
function examPages(id: 'protocolo' | 'recorridos', pages: number): Page[] {
  return Array.from({ length: pages }, (_, index) =>
    page({ source: id, page: index + 1, category: 'exam', kind: 'other', summary: 'Página' }),
  );
}

/** Two manual pages and one guide page (a cover, a page with one unit, and a guide cover), plus the exam documents. */
export function catalog() {
  return {
    manifest: [source('manual', 2), source('siniestros', 1), source('protocolo', 42), source('recorridos', 19)],
    pages: [
      page({ source: 'manual', page: 1 }),
      page({
        source: 'manual',
        page: 2,
        section: 'ch3',
        category: 'B',
        kind: 'instructional',
        summary: 'Rotonda',
        units: ['manual.ch3.roundabout-priority'],
      }),
      page({ source: 'siniestros', page: 1, category: 'guide' }),
      ...examPages('protocolo', 42),
      ...examPages('recorridos', 19),
    ],
    units: [unit({ id: 'manual.ch3.roundabout-priority' })],
    signs: [] as Sign[],
    issues: [] as Array<{ source: 'manual' | 'siniestros'; page: number | null; type: 'typo'; description: string }>,
  };
}

export function rule(overrides: Partial<Rule> & Pick<Rule, 'id' | 'severity' | 'annexItem' | 'points'>): Rule {
  return {
    fichaRows: [{ stage: 'II', group: 'Maniobrabilidad', text: 'Conducta', page: 15 }],
    condition: 'Condición.',
    repetition: 'once',
    interrupts: false,
    escalation: null,
    exceptions: [],
    examinerAction: null,
    parameters: {},
    refs: [{ source: 'protocolo', page: 23 }],
    status: 'transcribed',
    notes: '',
    ...overrides,
  };
}

export function ruleCatalog(rules: Rule[]): RuleCatalog {
  return {
    source: { id: 'protocolo', edition: '2023', sha256: 'a'.repeat(64) },
    scoring: {
      pointsBySeverity: { minor: 1, low: 2, high: 3, eliminatory: 8 },
      passMaxPoints: 7,
      failMinPoints: 8,
      requiresAllStagesCompleted: true,
      cumulativeAcrossStages: true,
      maxPointsBeforeCirculation: 7,
      refs: [{ source: 'protocolo', page: 14 }],
    },
    parkingBands: [
      { band: 'too-close', lt: 15, rule: null },
      { band: 'correct', gte: 15, lte: 25, rule: null },
      { band: 'second-line', gt: 25, lte: 50, rule: null },
      { band: 'outside', gt: 50, rule: null },
    ],
    rules,
  };
}

const PROJECTION: Route['projection'] = {
  type: 'local-equirectangular-wgs84',
  originOsmNode: 1,
  originLat: -34.55,
  originLon: -58.46,
  metersPerDegLon: 91780,
  metersPerDegLat: 110932,
  axes: 'x este, y norte',
  scaleSource: 'WGS84',
};

export function routePoint(osmNode: number, x: number, y: number) {
  return {
    osmNode,
    x,
    y,
    lat: PROJECTION.originLat + y / PROJECTION.metersPerDegLat,
    lon: PROJECTION.originLon + x / PROJECTION.metersPerDegLon,
  };
}

function leg(overrides: Partial<RouteLeg> & Pick<RouteLeg, 'leg' | 'street' | 'officialSteps' | 'path'>): RouteLeg {
  return {
    lengthM: 200,
    osmWays: [10],
    oneWay: true,
    roadType: 'street',
    postedMaxKmhOsm: [40],
    examMaxKmh: 30,
    lanesOsm: [],
    cycleTrack: 'none',
    segments: [
      {
        osmWay: 10,
        fromIndex: 0,
        toIndex: overrides.path.length - 1,
        cycleTrackLeft: false,
        maxspeedOsm: 40,
        lanesOsm: null,
      },
    ],
    turnIntoNext: { direction: 'left', angleDeg: 90, nextStreet: 'X' },
    status: 'single-source',
    evidence: 'OSM',
    ...overrides,
  };
}

/** A 100 m square loop with two legs that turn left into each other. */
export function route(): Route {
  return {
    id: 'test',
    name: 'Test',
    officialSequence: ['Uno', 'Av. Dos', 'Uno'],
    sources: {
      route: [{ source: 'recorridos', page: 16 }],
      osm: { baseTimestamp: '2026-10-11T00:00:00Z', license: 'ODbL-1.0', attribution: 'OSM' },
      gcba: {
        dataset: 'https://data.example.org/x',
        downloaded: '2026-10-11',
        license: 'CC-BY-2.5-AR',
        attribution: 'GCBA',
      },
    },
    projection: PROJECTION,
    loopLengthM: 400,
    start: { label: 'Inicio', leg: 1, status: 'approximation', notes: '' },
    legs: [
      leg({
        leg: 1,
        street: 'Uno',
        officialSteps: [3, 1],
        path: [routePoint(1, 0, 0), routePoint(2, 100, 0), routePoint(3, 100, 100)],
      }),
      leg({
        leg: 2,
        street: 'Avenida Dos',
        officialSteps: [2],
        roadType: 'avenue',
        examMaxKmh: 45,
        path: [routePoint(3, 100, 100), routePoint(4, 0, 100), routePoint(1, 0, 0)],
      }),
    ],
    controls: [
      {
        legs: [2],
        type: 'traffic_signals',
        status: 'sources-verified',
        sources: ['osm', 'gcba'],
        ...routePoint(4, 0, 100),
      },
    ],
    context: [],
  };
}

export function choiceActivity(
  overrides: Partial<Extract<Activity, { type: 'single-choice' }>> = {},
): Extract<Activity, { type: 'single-choice' }> {
  return {
    id: 'act.speed-street',
    type: 'single-choice',
    title: 'Velocidad en calle',
    unitIds: ['manual.ch3.roundabout-priority'],
    refs: [{ source: 'manual', page: 2 }],
    explanation: 'Explicación.',
    status: 'reviewed',
    variants: [
      {
        id: 'v1',
        prompt: '¿Cuál?',
        options: [
          { id: 'a', text: 'A', correct: true, feedback: 'Bien' },
          { id: 'b', text: 'B', correct: false, feedback: 'No' },
          { id: 'c', text: 'C', correct: false, feedback: 'Tampoco' },
        ],
      },
    ],
    ...overrides,
  };
}

/** A mock exam of 2 questions out of the ch3 section of the fixture catalog, pass with 1. */
export function theoryExamConfig(overrides: Partial<TheoryExamConfig> = {}): TheoryExamConfig {
  return {
    version: '2026-10-12',
    questions: 2,
    passCorrect: 1,
    optionsPerQuestion: 2,
    timeMinutes: { default: 45, alternatives: [40] },
    sections: ['manual-ch3'],
    sources: ['questions', 'options', 'pass', 'time'].map((parameter) => ({
      parameter: parameter as TheoryExamConfig['sources'][number]['parameter'],
      text: 'Dato.',
      reference: 'Disposición 860/2023, p. 96.',
      url: 'https://example.org/disposicion.pdf',
    })),
    notes: '',
    ...overrides,
  };
}
