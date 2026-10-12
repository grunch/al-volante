import type { AuditedSourceId, Category } from '../content/schemas.ts';
import { t } from '../i18n/es-AR.ts';

export interface PathSection {
  source: AuditedSourceId;
  section: string;
}

export interface PathGroup {
  id: 'campaign-b' | 'reference' | 'complementary' | 'practical';
  sections: PathSection[];
}

/**
 * Study order. Campaign B follows "Material a estudiar" for licence B (manual PDF 3): introduction, chapters 1–5,
 * annex I and annex IV. Complementary material (annexes II–III, crash guide) has its own progress (PROPUESTA §6).
 */
export const LEARNING_PATH: PathGroup[] = [
  {
    id: 'campaign-b',
    sections: ['intro', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'annex1', 'annex4'].map((section) => ({
      source: 'manual',
      section,
    })),
  },
  {
    id: 'reference',
    sections: [
      { source: 'manual', section: 'front' },
      { source: 'manual', section: 'glossary' },
    ],
  },
  {
    id: 'complementary',
    sections: [
      { source: 'manual', section: 'annex2' },
      { source: 'manual', section: 'annex3' },
      ...['intro', 's1', 's2', 's3'].map((section) => ({ source: 'siniestros' as const, section })),
    ],
  },
  {
    // The practical exam documents (F05-T04): what the driving exam evaluates and the circuits of every comuna.
    id: 'practical',
    sections: [
      ...['general', 'stages', 'evaluation', 'annex1', 'annex2', 'annex3'].map((section) => ({
        source: 'protocolo' as const,
        section,
      })),
      ...['intro', 'circuits'].map((section) => ({ source: 'recorridos' as const, section })),
    ],
  },
];

/** Categories that count towards campaign B progress. */
export const CAMPAIGN_B_CATEGORIES: readonly Category[] = ['B'];

/** Visible title of each learning-path group. */
export const GROUP_TITLES: Record<PathGroup['id'], string> = {
  'campaign-b': t('mapCampaignB'),
  reference: t('mapReference'),
  complementary: t('mapComplementary'),
  practical: t('mapPractical'),
};
