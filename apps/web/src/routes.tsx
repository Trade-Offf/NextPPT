import { lazy, Suspense } from 'react';
import type { RouteRecord } from 'vite-react-ssg';
import { LocaleLayout } from './components/LocaleLayout.js';
import { RouteErrorPage } from './components/RouteErrorPage.js';
import { LandingPage } from './pages/LandingPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
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

const TemplateDetailPage = lazy(() =>
  import('./pages/TemplatesPage.js').then((m) => ({ default: m.TemplateDetailPage })),
);

const ExplorePage = lazy(() =>
  import('./pages/ExplorePage.js').then((m) => ({ default: m.ExplorePage })),
);

const ExploreArticlePage = lazy(() =>
  import('./pages/ExploreArticlePage.js').then((m) => ({ default: m.ExploreArticlePage })),
);

const HtmlWorkbenchPage = lazy(() =>
  import('./pages/HtmlWorkbenchPage.js').then((m) => ({ default: m.HtmlWorkbenchPage })),
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

function localeChildren() {
  return [
    { index: true, element: <HomeRoute /> },
    { path: 'guide', element: <Suspense fallback={null}><GuidePage /></Suspense> },
    { path: 'guide/:tab', element: <Suspense fallback={null}><GuidePage /></Suspense> },
    { path: 'templates', element: <Suspense fallback={null}><TemplatesPage /></Suspense> },
    { path: 'templates/:id', element: <Suspense fallback={null}><TemplateDetailPage /></Suspense> },
    { path: 'explore', element: <Suspense fallback={null}><ExplorePage /></Suspense> },
    { path: 'explore/:slug', element: <Suspense fallback={null}><ExploreArticlePage /></Suspense> },
    { path: 'html', element: <Suspense fallback={null}><HtmlWorkbenchPage /></Suspense> },
    // Unknown paths get a branded 404 with noindex instead of a silent redirect.
    { path: '*', element: <NotFoundPage /> },
  ];
}

export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <LocaleLayout locale={'zh' as Locale} />,
    errorElement: <RouteErrorPage />,
    children: localeChildren(),
  },
  {
    path: '/en',
    element: <LocaleLayout locale={'en' as Locale} />,
    errorElement: <RouteErrorPage />,
    children: localeChildren(),
  },
];
