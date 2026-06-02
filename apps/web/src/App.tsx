import { useEffect } from 'react';
import { useDeckStore } from './store/deckStore.js';
import { LandingPage } from './pages/LandingPage.js';
import { EditorPage } from './pages/EditorPage.js';
import { GuidePage } from './pages/GuidePage.js';
import type { GuideTab } from './data/guide.js';

const GUIDE_ANCHORS = ['generate', 'existing', 'export'] as const;

function anchorFromHash(): GuideTab | null {
  const h = window.location.hash.replace('#', '');
  return (GUIDE_ANCHORS as readonly string[]).includes(h) ? (h as GuideTab) : null;
}

export default function App() {
  const hasDeck = useDeckStore((s) => s.slides.length > 0);
  const guideOpen = useDeckStore((s) => s.guideOpen);
  const setGuide = useDeckStore((s) => s._setGuide);

  // Keep the guide overlay in sync with the URL so /guide is a real,
  // deep-linkable, indexable route — without pulling in a router dependency.
  useEffect(() => {
    const sync = () => {
      const onGuide = window.location.pathname.startsWith('/guide');
      setGuide(onGuide, onGuide ? anchorFromHash() : null);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [setGuide]);

  return (
    <>
      {hasDeck ? <EditorPage /> : <LandingPage />}
      {guideOpen && <GuidePage />}
    </>
  );
}
