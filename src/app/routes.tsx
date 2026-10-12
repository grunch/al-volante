import type { RouteObject } from 'react-router';
import { Layout } from './Layout.tsx';
import { ActivitiesPage } from './pages/ActivitiesPage.tsx';
import { ActivityPage } from './pages/ActivityPage.tsx';
import { ExamPage } from './pages/ExamPage.tsx';
import { GaragePage } from './pages/GaragePage.tsx';
import { LogbookPage } from './pages/LogbookPage.tsx';
import { TrackPage } from './pages/TrackPage.tsx';
import { CityPage } from './pages/CityPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LearningMapPage } from './pages/LearningMapPage.tsx';
import { LibraryPage } from './pages/LibraryPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { SectionPage } from './pages/SectionPage.tsx';
import { SignsPage } from './pages/SignsPage.tsx';
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
      { path: '/examen', element: <ExamPage /> },
      { path: '/recorrido', element: <CityPage /> },
      { path: '/biblioteca', element: <LibraryPage /> },
      { path: '/biblioteca/:source/:page', element: <SourcePage /> },
      { path: '/senales', element: <SignsPage /> },
      { path: '/garaje', element: <GaragePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
