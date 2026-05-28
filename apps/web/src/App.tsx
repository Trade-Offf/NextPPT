import { useDeckStore } from './store/deckStore.js';
import { LandingPage } from './pages/LandingPage.js';
import { EditorPage } from './pages/EditorPage.js';

export default function App() {
  const hasDeck = useDeckStore((s) => s.slides.length > 0);
  return hasDeck ? <EditorPage /> : <LandingPage />;
}
