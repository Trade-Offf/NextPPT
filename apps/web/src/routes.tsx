import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import type { RouteRecord } from 'vite-react-ssg';
import { LocaleLayout } from './components/LocaleLayout.js';
import { LandingPage } from './pages/LandingPage.js';
import { useDeckStore } from './store/deckStore.js';
import type { Locale } from './i18n/index.js';

// Editor (and Monaco) must never be imported during prerender — store starts
// empty so HomeRoute always renders the landing page server-side.
const EditorPage = lazy(() =>
  import('./pages/EditorPage.js').then((m) => ({ default: m.EditorPage })),
);

const GuidePage = lazy(() =>
  import('./pages/GuidePage.js').then((m) => ({ default: m.GuidePage })),
);

const TemplatesPage = lazy(() =>
  import('./pages/TemplatesPage.js').then((m) => ({ default: m.TemplatesPage })),
);

const ExplorePage = lazy(() =>
  import('./pages/ExplorePage.js').then((m) => ({ default: m.ExplorePage })),
);

const ExploreArticlePage = lazy(() =>
  import('./pages/ExploreArticlePage.js').then((m) => ({ default: m.ExploreArticlePage })),
);

function HomeRoute() {
  const hasDeck = useDeckStore((s) => s.slides.length > 0);
  if (!hasDeck) return <LandingPage />;
  return (
    <Suspense fallback={null}>
      <EditorPage />
    </Suspense>
  );
}

function localeChildren(prefix: string) {
  return [
    { index: true, element: <HomeRoute /> },
    { path: 'guide', element: <Suspense fallback={null}><GuidePage /></Suspense> },
    { path: 'templates', element: <Suspense fallback={null}><TemplatesPage /></Suspense> },
    { path: 'explore', element: <Suspense fallback={null}><ExplorePage /></Suspense> },
    { path: 'explore/:slug', element: <Suspense fallback={null}><ExploreArticlePage /></Suspense> },
    // Unknown subpaths fall back to this locale's home instead of a blank shell.
    { path: '*', element: <Navigate to={prefix || '/'} replace /> },
  ];
}

export const routes: RouteRecord[] = [
  { path: '/', element: <LocaleLayout locale={'zh' as Locale} />, children: localeChildren('') },
  { path: '/en', element: <LocaleLayout locale={'en' as Locale} />, children: localeChildren('/en') },
];
