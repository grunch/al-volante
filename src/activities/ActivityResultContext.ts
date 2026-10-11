import { createContext } from 'react';
import type { Activity } from '../content/schemas.ts';
import type { Evaluation, Presentation } from './engine.ts';

export interface ActivityResult {
  activity: Activity;
  presentation: Presentation;
  evaluation: Evaluation;
}

/** Receives every finished attempt; progress tracking (F02-T05) subscribes here. Default: no-op. */
export const ActivityResultContext = createContext<(result: ActivityResult) => void>(() => undefined);
