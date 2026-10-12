import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { App } from '../app/App.tsx';
import { routes } from '../app/routes.tsx';
import type { Content, ContentResult } from '../content/validate.ts';
import type { ProgressStore } from '../progress/storage.ts';
import {
  catalog,
  choiceActivity,
  page,
  route,
  rule,
  ruleCatalog,
  sign,
  source,
  theoryExamConfig,
  unit,
} from '../content/testing/fixtures.ts';
import { createFakeRenderer } from './fakeRenderer.ts';

/** Small but realistic content: two manual sections, a guide page, a protocol rule and an issue. */
export function testContent(): Content {
  const base = catalog();
  return {
    manifest: [source('manual', 3), source('protocolo', 42), source('recorridos', 19), source('siniestros', 1)],
    pages: [
      ...base.pages,
      page({
        source: 'manual',
        page: 3,
        section: 'annex4',
        category: 'B',
        kind: 'instructional',
        summary: 'Señales reglamentarias',
        figures: [{ description: 'Cuadro de señales', instructional: true }],
      }),
    ],
    units: base.units,
    signs: [sign({ id: 'sign.regulatory.stop', page: 3, name: 'PARE', meaning: 'Detención obligatoria' })],
    issues: [{ source: 'manual', page: 2, type: 'discrepancy', description: 'Dato a verificar' }],
    rules: ruleCatalog([
      rule({
        id: 'rule.eliminatory.k-red-light',
        severity: 'eliminatory',
        annexItem: 'k',
        points: 8,
        refs: [{ source: 'protocolo', page: 32 }],
        fichaRows: [{ stage: 'II', group: 'Cruce', text: 'Cruza con el semáforo en rojo', page: 16 }],
      }),
    ]),
    route: route(),
    figures: [],
    theoryExam: theoryExamConfig(),
    activities: [choiceActivity()],
  };
}

export function readyContent(content: Content = testContent()): () => Promise<ContentResult> {
  return () => Promise.resolve({ ok: true, content, version: 'deadbeef' });
}

/** Renders the whole app at `path` with a memory router, a fake renderer, injected content and, optionally, a store. */
export function renderApp(
  path: string,
  loadContent: () => Promise<ContentResult> = readyContent(),
  store?: ProgressStore,
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <App
      router={router}
      createRenderer={createFakeRenderer}
      loadContent={loadContent}
      {...(store ? { openProgressStore: () => Promise.resolve(store) } : {})}
    />,
  );
  return { ...utils, router };
}

export { unit };
