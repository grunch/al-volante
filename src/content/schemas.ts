import { z } from 'zod';

// Structural schemas for every content catalog (PROPUESTA §8, "Contratos de datos mínimos").
// Cross-record references (pages ↔ units, rule items, route continuity…) are checked in validate.ts.

export const SOURCE_IDS = ['manual', 'protocolo', 'recorridos', 'siniestros'] as const;
export const AUDITED_SOURCE_IDS = ['manual', 'siniestros'] as const;
export const SourceIdSchema = z.enum(SOURCE_IDS);
export type SourceId = z.infer<typeof SourceIdSchema>;

const nonEmpty = z.string().trim().min(1);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const positiveInt = z.int().positive();
export const ContentStatusSchema = z.enum(['pending', 'transcribed', 'reviewed', 'implemented', 'tested']);

/** A citation of a physical PDF page. */
export const SourceRefSchema = z.strictObject({ source: SourceIdSchema, page: positiveInt });
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const SourceSchema = z.strictObject({
  id: SourceIdSchema,
  title: nonEmpty,
  edition: nonEmpty,
  path: nonEmpty,
  originalFilename: nonEmpty,
  pages: positiveInt,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  extractedText: nonEmpty,
  provenance: z.strictObject({ url: z.url(), retrievedAt: isoDate, sha256Verified: z.boolean() }),
});
export type Source = z.infer<typeof SourceSchema>;
export const ManifestSchema = z.array(SourceSchema).min(1);

export const CATEGORIES = ['B', 'common', 'D', 'C-E', 'guide'] as const;
export const PAGE_KINDS = [
  'instructional',
  'chapter-cover',
  'closing-quote',
  'toc',
  'cover',
  'credits',
  'blank',
  'other',
] as const;
export const UNIT_TYPES = [
  'definition',
  'rule',
  'procedure',
  'fact',
  'recommendation',
  'concept',
  'table',
  'contact',
  'sign-group',
] as const;
export const ISSUE_TYPES = ['discrepancy', 'illegible', 'typo', 'outdated', 'ambiguous', 'extraction'] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

export const PageSchema = z.strictObject({
  source: z.enum(AUDITED_SOURCE_IDS),
  page: positiveInt,
  printedPage: positiveInt.nullable(),
  section: nonEmpty,
  category: CategorySchema,
  kind: z.enum(PAGE_KINDS),
  summary: nonEmpty,
  units: z.array(z.string()),
  figures: z.array(z.strictObject({ description: nonEmpty, instructional: z.boolean() })),
  notes: z.string(),
});
export type Page = z.infer<typeof PageSchema>;

export const UNIT_ID_PATTERN = /^(manual|siniestros)\.[a-z0-9]+\.[a-z0-9]+(-[a-z0-9]+)*$/;
export const KnowledgeUnitSchema = z.strictObject({
  id: z.string().regex(UNIT_ID_PATTERN),
  source: z.enum(AUDITED_SOURCE_IDS),
  section: nonEmpty,
  pages: z.array(positiveInt).min(1),
  title: nonEmpty,
  category: CategorySchema,
  type: z.enum(UNIT_TYPES),
  summary: nonEmpty,
  keyFacts: z.array(nonEmpty),
  figureBased: z.boolean(),
  status: ContentStatusSchema,
  notes: z.string(),
  /**
   * Why the unit is studied as reference material (its section page and source page) instead of being evaluated,
   * e.g. contact data that may be outdated. Units without it are covered by activities (CONTENIDO.md).
   */
  consultationReason: nonEmpty.optional(),
});
export type KnowledgeUnit = z.infer<typeof KnowledgeUnitSchema>;

export const SIGN_ID_PATTERN = /^sign\.[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;
export const SignSchema = z.strictObject({
  id: z.string().regex(SIGN_ID_PATTERN),
  page: positiveInt,
  group: nonEmpty,
  name: nonEmpty,
  meaning: z.string(),
  visual: nonEmpty,
  printedCode: z.string().nullable(),
  status: ContentStatusSchema,
  notes: z.string(),
});
export type Sign = z.infer<typeof SignSchema>;

export const IssueSchema = z.strictObject({
  source: z.enum(AUDITED_SOURCE_IDS),
  page: positiveInt.nullable(),
  type: z.enum(ISSUE_TYPES),
  description: nonEmpty,
});
export type Issue = z.infer<typeof IssueSchema>;

// --- Exam rules (REGLAS.md) -------------------------------------------------------------------

export const SEVERITY_POINTS = { minor: 1, low: 2, high: 3, eliminatory: 8 } as const;
export const SeveritySchema = z.enum(['minor', 'low', 'high', 'eliminatory']);
export type Severity = z.infer<typeof SeveritySchema>;
export const REPETITION_POLICIES = ['once', 'per-occurrence', 'per-episode', 'single-check', 'unspecified'] as const;
export const ProtocolRefSchema = z.strictObject({ source: z.literal('protocolo'), page: positiveInt });

const boundSchema = z.number().nonnegative();
export const ParkingBandSchema = z.strictObject({
  band: nonEmpty,
  lt: boundSchema.optional(),
  lte: boundSchema.optional(),
  gt: boundSchema.optional(),
  gte: boundSchema.optional(),
  rule: z.string().nullable(),
  decision: z.string().optional(),
});
export type ParkingBand = z.infer<typeof ParkingBandSchema>;

export const RuleSchema = z.strictObject({
  id: z.string().regex(/^rule\.(minor|low|high|eliminatory)\.[a-z]-[a-z0-9]+(-[a-z0-9]+)*$/),
  severity: SeveritySchema,
  points: positiveInt,
  annexItem: z.string().regex(/^[a-z]$/),
  fichaRows: z
    .array(z.strictObject({ stage: z.enum(['I', 'II', 'III']), group: nonEmpty, text: nonEmpty, page: positiveInt }))
    .min(1),
  condition: nonEmpty,
  repetition: z.enum(REPETITION_POLICIES),
  interrupts: z.boolean(),
  escalation: z
    .strictObject({
      condition: nonEmpty,
      severity: z.literal('eliminatory'),
      points: z.literal(8),
      interrupts: z.literal(true),
    })
    .nullable(),
  exceptions: z.array(nonEmpty),
  examinerAction: z.string().nullable(),
  parameters: z.record(z.string(), z.unknown()),
  refs: z.array(ProtocolRefSchema).min(1),
  status: ContentStatusSchema,
  notes: z.string(),
});
export type Rule = z.infer<typeof RuleSchema>;

export const RuleCatalogSchema = z.strictObject({
  source: z.strictObject({ id: z.literal('protocolo'), edition: nonEmpty, sha256: z.string().regex(/^[0-9a-f]{64}$/) }),
  scoring: z.strictObject({
    pointsBySeverity: z.strictObject({
      minor: z.literal(1),
      low: z.literal(2),
      high: z.literal(3),
      eliminatory: z.literal(8),
    }),
    passMaxPoints: z.literal(7),
    failMinPoints: z.literal(8),
    // Fixed by the protocol: all three stages must be completed and points add up across them (PDF 14); reaching
    // circulation with 8 points or more interrupts the exam (PDF 10).
    requiresAllStagesCompleted: z.literal(true),
    cumulativeAcrossStages: z.literal(true),
    maxPointsBeforeCirculation: z.literal(7),
    refs: z.array(ProtocolRefSchema).min(1),
  }),
  parkingBands: z.array(ParkingBandSchema).min(1),
  rules: z.array(RuleSchema),
});
export type RuleCatalog = z.infer<typeof RuleCatalogSchema>;

// --- Route (RECORRIDO.md) — the RoadSegment contract ----------------------------------------

export const VERIFICATION_STATUSES = [
  'sources-verified',
  'single-source',
  'discrepancy',
  'approximation',
  'surveyed',
] as const;
const VerificationStatusSchema = z.enum(VERIFICATION_STATUSES);
const finite = z.number().finite();

export const RoutePointSchema = z.strictObject({
  osmNode: z.int().nullable(),
  lat: finite,
  lon: finite,
  x: finite,
  y: finite,
});
export const RouteLegSchema = z.strictObject({
  leg: positiveInt,
  street: nonEmpty,
  officialSteps: z.array(positiveInt).min(1),
  lengthM: finite.positive(),
  osmWays: z.array(z.int()).min(1),
  oneWay: z.boolean(),
  roadType: z.enum(['street', 'avenue']),
  postedMaxKmhOsm: z.array(positiveInt),
  examMaxKmh: positiveInt,
  lanesOsm: z.array(z.string()),
  cycleTrack: z.enum(['none', 'partial', 'full']),
  segments: z
    .array(
      z.strictObject({
        osmWay: z.int(),
        fromIndex: z.int().nonnegative(),
        toIndex: positiveInt,
        cycleTrackLeft: z.boolean(),
        maxspeedOsm: positiveInt.nullable(),
        lanesOsm: positiveInt.nullable(),
      }),
    )
    .min(1),
  turnIntoNext: z.strictObject({ direction: z.enum(['left', 'right']), angleDeg: finite, nextStreet: nonEmpty }),
  path: z.array(RoutePointSchema).min(2),
  status: VerificationStatusSchema,
  evidence: nonEmpty,
});
export type RouteLeg = z.infer<typeof RouteLegSchema>;

export const RouteControlSchema = RoutePointSchema.extend({
  legs: z.array(positiveInt).min(1),
  type: nonEmpty,
  sources: z.array(nonEmpty).min(1),
  gcbaId: z.string().optional(),
  gcbaAddress: z.string().optional(),
  status: VerificationStatusSchema,
  notes: z.string().optional(),
}).strict();

export const RouteSchema = z.strictObject({
  id: nonEmpty,
  name: nonEmpty,
  officialSequence: z.array(nonEmpty).min(1),
  sources: z.strictObject({
    route: z.array(SourceRefSchema).min(1),
    osm: z.strictObject({ baseTimestamp: nonEmpty, license: nonEmpty, attribution: nonEmpty }),
    gcba: z.strictObject({ dataset: z.url(), downloaded: isoDate, license: nonEmpty, attribution: nonEmpty }),
  }),
  projection: z.strictObject({
    type: nonEmpty,
    originOsmNode: z.int(),
    originLat: finite,
    originLon: finite,
    metersPerDegLon: finite.positive(),
    metersPerDegLat: finite.positive(),
    axes: nonEmpty,
    scaleSource: nonEmpty,
  }),
  loopLengthM: finite.positive(),
  start: z.strictObject({ label: nonEmpty, leg: positiveInt, status: VerificationStatusSchema, notes: z.string() }),
  legs: z.array(RouteLegSchema).min(1),
  controls: z.array(RouteControlSchema),
  context: z.array(
    z.strictObject({ type: nonEmpty, street: nonEmpty, status: VerificationStatusSchema, notes: nonEmpty }),
  ),
});
export type Route = z.infer<typeof RouteSchema>;

// --- Figures (crops of the official PDFs, CONTENIDO.md) --------------------------------------

export const FIGURE_ID_PATTERN = /^fig\.[a-z0-9]+(-[a-z0-9]+)*$/;
const fraction = z.number().min(0).max(1);
export const FigureSchema = z.strictObject({
  id: z.string().regex(FIGURE_ID_PATTERN),
  source: SourceIdSchema,
  page: positiveInt,
  /** Crop of the physical page as fractions of its width and height, origin at the top left corner. */
  box: z.strictObject({ x: fraction, y: fraction, width: fraction.positive(), height: fraction.positive() }),
  /** Accessible description: what the figure shows, with the data a sighted reader would get from it. */
  alt: nonEmpty,
  unitIds: z.array(z.string().regex(UNIT_ID_PATTERN)).min(1),
});
export type Figure = z.infer<typeof FigureSchema>;
export const FigureCatalogSchema = z.array(FigureSchema);

// --- Activities (F02-T04 fills the catalog) -------------------------------------------------

const ActivityBaseSchema = z.strictObject({
  id: z.string().regex(/^act\.[a-z0-9]+(-[a-z0-9]+)*$/),
  title: nonEmpty,
  unitIds: z.array(z.string().regex(UNIT_ID_PATTERN)).min(1),
  refs: z.array(SourceRefSchema).min(1),
  explanation: nonEmpty,
  status: z.enum(['draft', 'reviewed']),
  /** Figures shown with the feedback, after answering: they may contain the answer. */
  figureIds: z.array(z.string().regex(FIGURE_ID_PATTERN)).min(1).optional(),
});

const ChoiceOptionSchema = z.strictObject({ id: nonEmpty, text: nonEmpty, correct: z.boolean(), feedback: nonEmpty });
const ChoiceVariantSchema = z.strictObject({
  id: nonEmpty,
  prompt: nonEmpty,
  options: z.array(ChoiceOptionSchema).min(2),
});

export const SingleChoiceActivitySchema = ActivityBaseSchema.extend({
  type: z.literal('single-choice'),
  variants: z.array(ChoiceVariantSchema).min(1),
}).strict();

export const SignIdentificationActivitySchema = ActivityBaseSchema.extend({
  type: z.literal('sign-identification'),
  variants: z.array(ChoiceVariantSchema.extend({ signId: z.string().regex(SIGN_ID_PATTERN) }).strict()).min(1),
}).strict();

export const OrderingActivitySchema = ActivityBaseSchema.extend({
  type: z.literal('ordering'),
  variants: z
    .array(
      z.strictObject({
        id: nonEmpty,
        prompt: nonEmpty,
        /** Items listed in the correct order; the engine shuffles them for presentation. */
        items: z.array(z.strictObject({ id: nonEmpty, text: nonEmpty, reason: nonEmpty })).min(2),
      }),
    )
    .min(1),
}).strict();

const DecisionChoiceSchema = z.strictObject({
  id: nonEmpty,
  text: nonEmpty,
  next: z.string().optional(),
  outcome: z.string().optional(),
});
export const DecisionActivitySchema = ActivityBaseSchema.extend({
  type: z.literal('decision'),
  variants: z
    .array(
      z.strictObject({
        id: nonEmpty,
        start: nonEmpty,
        nodes: z.record(z.string(), z.strictObject({ text: nonEmpty, choices: z.array(DecisionChoiceSchema).min(2) })),
        outcomes: z.record(z.string(), z.strictObject({ correct: z.boolean(), feedback: nonEmpty })),
      }),
    )
    .min(1),
}).strict();

export const ActivitySchema = z.discriminatedUnion('type', [
  SingleChoiceActivitySchema,
  SignIdentificationActivitySchema,
  OrderingActivitySchema,
  DecisionActivitySchema,
]);
export type Activity = z.infer<typeof ActivitySchema>;
export const ActivityCatalogSchema = z.array(ActivitySchema);

// --- Scenario and attempt contracts (driving uses them from phase 3) ------------------------

export const ScenarioSchema = z.strictObject({
  id: z.string().regex(/^scn\.[a-z0-9]+(-[a-z0-9]+)*$/),
  seed: z.int().nonnegative(),
  initialState: z.record(z.string(), z.unknown()),
  actors: z.array(z.strictObject({ id: nonEmpty, kind: nonEmpty, spawn: z.record(z.string(), z.unknown()) })),
  objectives: z.array(nonEmpty).min(1),
  activeRuleIds: z.array(z.string()),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ATTEMPT_MODES = ['learn', 'practice', 'review', 'run', 'exam'] as const;
export const AttemptSchema = z
  .strictObject({
    id: nonEmpty,
    kind: z.enum(['activity', 'driving']),
    subjectId: nonEmpty,
    contentVersion: z.string().regex(/^[0-9a-f]{8,}$/),
    mode: z.enum(ATTEMPT_MODES),
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
    events: z.array(
      z.strictObject({ at: z.iso.datetime(), type: nonEmpty, payload: z.record(z.string(), z.unknown()) }),
    ),
    faults: z.array(z.strictObject({ ruleId: nonEmpty, at: z.iso.datetime(), points: z.int().nonnegative() })),
    result: z.strictObject({
      correct: z.boolean().nullable(),
      score: z.number().min(0).max(1).nullable(),
      points: z.int().nonnegative().nullable(),
    }),
  })
  .check((ctx) => {
    // An attempt ends after it starts, and everything it records happens in between.
    const { startedAt, finishedAt, events, faults } = ctx.value;
    const start = Date.parse(startedAt);
    const end = finishedAt === null ? Infinity : Date.parse(finishedAt);
    const fail = (message: string) => ctx.issues.push({ code: 'custom', message, input: ctx.value });
    if (end < start) fail('an attempt cannot finish before it starts');
    for (const { at } of [...events, ...faults]) {
      const time = Date.parse(at);
      if (time < start || time > end) fail(`${at} falls outside the attempt`);
    }
  });
export type Attempt = z.infer<typeof AttemptSchema>;
