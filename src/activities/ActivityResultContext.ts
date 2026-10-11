import { createContext } from 'react';
import type { Activity } from '../content/schemas.ts';
import type { ActivityResponse, Evaluation, Presentation } from './engine.ts';

export interface ActivityResult {
  activity: Activity;
  presentation: Presentation;
  response: ActivityResponse;
  evaluation: Evaluation;
}

/** What happened to a finished attempt: stored, lost on a failed write, or not recorded at all. */
export type SaveOutcome = 'saved' | 'failed' | 'not-recorded';

/** Receives every finished attempt and tells whether it was saved; progress tracking (F02-T05) subscribes here. */
export const ActivityResultContext = createContext<(result: ActivityResult) => Promise<SaveOutcome>>(() =>
  Promise.resolve('not-recorded'),
);
