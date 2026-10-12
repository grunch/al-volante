import type { Category } from '../content/schemas.ts';
import { t } from '../i18n/es-AR.ts';

export interface PathSection {
  source: 'manual' | 'siniestros';
  section: string;
}

export interface PathGroup {
  id: 'campaign-b' | 'reference' | 'complementary';
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
];

/** Categories that count towards campaign B progress. */
export const CAMPAIGN_B_CATEGORIES: readonly Category[] = ['B'];

/** Visible title of each learning-path group. */
export const GROUP_TITLES: Record<PathGroup['id'], string> = {
  'campaign-b': t('mapCampaignB'),
  reference: t('mapReference'),
  complementary: t('mapComplementary'),
};
