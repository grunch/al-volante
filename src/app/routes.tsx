import type { RouteObject } from 'react-router';
import { Layout } from './Layout.tsx';
import { ActivitiesPage } from './pages/ActivitiesPage.tsx';
import { ActivityPage } from './pages/ActivityPage.tsx';
import { LogbookPage } from './pages/LogbookPage.tsx';
import { TrackPage } from './pages/TrackPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LearningMapPage } from './pages/LearningMapPage.tsx';
import { LibraryPage } from './pages/LibraryPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { SectionPage } from './pages/SectionPage.tsx';
import { SourcePage } from './pages/SourcePage.tsx';

/** Route table shared by the hash router (app) and memory routers (tests). */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/mapa', element: <LearningMapPage /> },
      { path: '/mapa/:source/:section', element: <SectionPage /> },
      { path: '/actividades', element: <ActivitiesPage /> },
      { path: '/actividad/:id', element: <ActivityPage /> },
      { path: '/bitacora', element: <LogbookPage /> },
      { path: '/pista', element: <TrackPage /> },
      { path: '/biblioteca', element: <LibraryPage /> },
      { path: '/biblioteca/:source/:page', element: <SourcePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
