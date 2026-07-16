/**
 * HtmlWorkbenchPage – the HTML workbench entry.
 *
 * Loads an HTML file into a LiveFrame (scripts kept alive), lets the user
 * tweak text + visual offsets in place, and exports a clean HTML file with
 * the original scripts intact and the tweaks baked in as inline styles.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ChangeSummary, LiveHostMessage, LiveRuntimeMessage } from '@hds/protocol';
import { Head } from 'vite-react-ssg';
import { SiteHeader } from '../components/SiteHeader.js';
import { LiveFrame } from '../components/LiveFrame.js';
import { pickFile } from '../fs/adapter.js';

interface Selection {
  tweakId: string;
  tagName: string;
  text?: string;
  translate?: string;
  scale?: string;
}

export function HtmlWorkbenchPage() {
  const { t } = useTranslation('htmlWorkbench');
  const [sourceHtml, setSourceHtml] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [remountKey, setRemountKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dirty, setDirty] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [changes, setChanges] = useState<ChangeSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ total: number; current: number }>({ total: 0, current: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const searchTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  // Clear toast + search timers on unmount.
  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
  }, []);

  const resetWorkbench = useCallback(() => {
    setReady(false);
    setSelection(null);
    setDirty(false);
    setError(null);
    setEditMode(false);
    setChanges([]);
    setSearchQuery('');
    setSearchResult({ total: 0, current: 0 });
  }, []);

  const loadFile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { fileName: name, html } = await pickFile();
      if (!/\.html?$/i.test(name)) {
        setError(t('page.errorNoHtml'));
        return;
      }
      setSourceHtml(html);
      setFileName(name);
      setRemountKey((k) => k + 1);
      resetWorkbench();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(t('page.errorFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [t, resetWorkbench]);

  // Care-first: let users try the workbench without preparing a file.
  // Loads the bundled sample deck so the empty state never feels like a dead end.
  const loadSample = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/sample-deck.html');
      if (!res.ok) throw new Error('fetch failed');
      const html = await res.text();
      setSourceHtml(html);
      setFileName('sample-deck.html');
      setRemountKey((k) => k + 1);
      resetWorkbench();
    } catch {
      setError(t('page.errorFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, resetWorkbench]);

  // Pick up a file stashed by the homepage split-drop (left half → HTML 演示台).
  useEffect(() => {
    const pending = sessionStorage.getItem('hds_pending_html');
    if (!pending) return;
    sessionStorage.removeItem('hds_pending_html');
    try {
      const { name, text } = JSON.parse(pending) as { name: string; text: string };
      setSourceHtml(text);
      setFileName(name);
      setRemountKey((k) => k + 1);
      resetWorkbench();
    } catch {
      setError(t('page.errorFailed'));
    }
  }, [t, resetWorkbench]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !/\.html?$/i.test(file.name)) {
      setError(t('page.errorNoHtml'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const html = await file.text();
      setSourceHtml(html);
      setFileName(file.name);
      setRemountKey((k) => k + 1);
      resetWorkbench();
    } catch {
      setError(t('page.errorFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, resetWorkbench]);

  const postToRuntime = useCallback((msg: LiveHostMessage) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => {
      const next = !prev;
      postToRuntime({ type: 'live-set-edit-mode', enabled: next });
      return next;
    });
  }, [postToRuntime]);

  const handleFocusElement = useCallback((tweakId: string) => {
    postToRuntime({ type: 'live-focus-element', tweakId });
  }, [postToRuntime]);

  const handleSearchRun = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => {
      postToRuntime({ type: 'live-search', query, action: 'run' });
    }, 200);
  }, [postToRuntime]);

  const handleSearchNav = useCallback((direction: 'next' | 'prev') => {
    postToRuntime({ type: 'live-search', query: searchQuery, action: direction });
  }, [postToRuntime, searchQuery]);

  // Export request/response correlation via incrementing id, so a late reply
  // to an aborted earlier request can't resolve the wrong promise.
  const exportRequestId = useRef(0);
  const pendingExport = useRef<{ id: number; resolve: (html: string) => void } | null>(null);

  const requestHtml = useCallback((): Promise<string> => {
    return new Promise<string>((resolve) => {
      const id = ++exportRequestId.current;
      pendingExport.current = { id, resolve };
      postToRuntime({ type: 'live-request-html' });
      window.setTimeout(() => {
        if (pendingExport.current && pendingExport.current.id === id) {
          pendingExport.current.resolve('');
          pendingExport.current = null;
        }
      }, 3000);
    });
  }, [postToRuntime]);

  const handleMessage = useCallback((msg: LiveRuntimeMessage) => {
    switch (msg.type) {
      case 'live-ready':
        setReady(true);
        break;
      case 'live-select':
        setSelection({
          tweakId: msg.tweakId,
          tagName: msg.tagName,
          text: msg.text,
          translate: msg.translate,
          scale: msg.scale,
        });
        break;
      case 'live-clear-select':
        setSelection(null);
        break;
      case 'live-patched':
        setDirty(true);
        break;
      case 'live-tweak-changed': {
        setDirty(true);
        // Functional update: avoid stale `selection` closure so an update for
        // the currently-selected element always lands even if selection just
        // changed in the same tick.
        const tid = msg.tweakId;
        setSelection((prev) =>
          prev && prev.tweakId === tid
            ? { ...prev, translate: msg.translate, scale: msg.scale }
            : prev,
        );
        break;
      }
      case 'live-response-html':
        if (pendingExport.current) {
          pendingExport.current.resolve(msg.html);
          pendingExport.current = null;
        }
        break;
      case 'live-error':
        setError(msg.message);
        break;
      case 'live-history-changed':
        setCanUndo(msg.canUndo);
        setCanRedo(msg.canRedo);
        break;
      case 'live-changes-updated':
        setChanges(msg.changes);
        break;
      case 'live-search-result':
        setSearchResult({ total: msg.total, current: msg.current });
        break;
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!sourceHtml || exporting) return;
    setExporting(true);
    try {
      const html = await requestHtml();
      if (!html) {
        showToast(t('toast.exportFailed'));
        return;
      }
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = fileName.replace(/\.html?$/i, '');
      const now = new Date();
      const ts = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      a.download = `${baseName}-edited-${ts}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(t('toast.exported'));
    } catch {
      showToast(t('toast.exportFailed'));
    } finally {
      setExporting(false);
    }
  }, [sourceHtml, exporting, fileName, requestHtml, showToast, t]);

  const handleResetTweak = useCallback(() => {
    if (!selection) return;
    postToRuntime({ type: 'live-reset-tweak', tweakId: selection.tweakId });
    showToast(t('toast.reset'));
  }, [selection, postToRuntime, showToast, t]);

  const handleResetAll = useCallback(() => {
    postToRuntime({ type: 'live-reset-all' });
    showToast(t('toast.reset'));
  }, [postToRuntime, showToast, t]);

  const handleUndo = useCallback(() => {
    postToRuntime({ type: 'live-undo' });
  }, [postToRuntime]);

  const handleRedo = useCallback(() => {
    postToRuntime({ type: 'live-redo' });
  }, [postToRuntime]);

  // Host-level undo/redo shortcut. The runtime also handles Cmd/Ctrl+Z inside
  // the iframe, but we listen here too so the shortcut works even when the
  // iframe doesn't have focus (e.g. right after clicking a toolbar button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  return (
    <div
      className="min-h-[100dvh] flex flex-col hds-html-workbench"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <SiteHeader alwaysScrolled />

      <main className="flex-1 flex flex-col">
        {!sourceHtml ? (
          <EmptyState onPick={loadFile} onTrySample={loadSample} loading={loading} error={error} t={t} />
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Toolbar */}
            <div className="hds-toolbar border-b border-[var(--separator)] px-4 py-2 flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-[var(--secondary-label)] truncate max-w-[200px]">
                  {fileName}
                </span>
                {dirty && (
                  <span className="text-[10px] text-[var(--system-blue)] font-mono">•</span>
                )}
                {!ready && (
                  <span className="text-[10px] text-[var(--tertiary-label)]">{t('page.loading')}</span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={toggleEditMode}
                  className={`hds-btn-primary px-3 py-1.5 text-xs ${editMode ? 'ring-2 ring-[var(--system-blue)] ring-offset-1 ring-offset-[var(--vibrancy-toolbar)]' : ''}`}
                  disabled={!ready}
                  title={editMode ? t('toolbar.editModeActiveTitle') : t('toolbar.editModeTitle')}
                >
                  {editMode ? t('toolbar.done') : t('toolbar.edit')}
                </button>
                <span className="w-px h-5 bg-[var(--separator)]" />
                <button
                  onClick={handleUndo}
                  className="hds-btn px-2.5 py-1.5 text-xs font-mono"
                  disabled={!canUndo || !ready}
                  title={t('toolbar.undoTitle')}
                >
                  ⤺
                </button>
                <button
                  onClick={handleRedo}
                  className="hds-btn px-2.5 py-1.5 text-xs font-mono"
                  disabled={!canRedo || !ready}
                  title={t('toolbar.redoTitle')}
                >
                  ⤻
                </button>
                <span className="w-px h-5 bg-[var(--separator)]" />
                {selection && (
                  <button
                    onClick={handleResetTweak}
                    className="hds-btn px-3 py-1.5 text-xs"
                  >
                    {t('toolbar.resetTweak')}
                  </button>
                )}
                <button
                  onClick={handleResetAll}
                  className="hds-btn px-3 py-1.5 text-xs"
                  title={t('toolbar.resetAllTitle')}
                >
                  {t('toolbar.resetAll')}
                </button>
                <span className="w-px h-5 bg-[var(--separator)]" />
                <button
                  onClick={loadFile}
                  className="hds-btn px-3 py-1.5 text-xs"
                  disabled={loading}
                >
                  {t('page.pickFile')}
                </button>
                <button
                  onClick={handleExport}
                  className="hds-btn-primary px-4 py-1.5 text-xs"
                  disabled={exporting || !ready}
                  title={t('toolbar.snapshotHint')}
                >
                  {exporting ? t('toolbar.exporting') : t('toolbar.export')}
                </button>
              </div>
            </div>

            {/* Canvas + inspector */}
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 min-w-0 overflow-hidden bg-[var(--window-bg)]">
                <LiveFrame
                  sourceHtml={sourceHtml}
                  onMessage={handleMessage}
                  iframeRef={iframeRef}
                  remountKey={remountKey}
                />
              </div>

              {/* Inspector */}
              <aside className="w-64 hds-panel border-l border-[var(--separator)] shrink-0 hidden sm:flex flex-col">
                {/* Search */}
                <div className="p-3 border-b border-[var(--separator)]">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchRun(e.target.value)}
                      placeholder={t('search.placeholder')}
                      className="flex-1 min-w-0 h-7 px-2 text-xs font-mono bg-[var(--control-bg)] border border-[var(--separator)] rounded text-[var(--label)] placeholder:text-[var(--tertiary-label)] focus:outline-none focus:border-[var(--system-blue)]"
                    />
                    <button
                      onClick={() => handleSearchNav('prev')}
                      disabled={searchResult.total === 0}
                      className="hds-btn px-1.5 py-1 text-[10px] font-mono disabled:opacity-30"
                      title={t('search.prev')}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleSearchNav('next')}
                      disabled={searchResult.total === 0}
                      className="hds-btn px-1.5 py-1 text-[10px] font-mono disabled:opacity-30"
                      title={t('search.next')}
                    >
                      ▼
                    </button>
                  </div>
                  {searchQuery && (
                    <div className="text-[10px] font-mono text-[var(--tertiary-label)] mt-1 tabular-nums">
                      {searchResult.total > 0
                        ? `${searchResult.current} / ${searchResult.total}`
                        : t('search.noResults')}
                    </div>
                  )}
                </div>

                {/* Element info */}
                <div className="p-3 border-b border-[var(--separator)]">
                  <div className="hds-inspector-label mb-2">{t('inspector.label')}</div>
                  {!selection ? (
                    <p className="text-xs text-[var(--tertiary-label)]">
                      {editMode ? t('inspector.none') : t('inspector.noneBrowse')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <InspectorRow label={t('inspector.tag')} value={selection.tagName} />
                      {selection.text && (
                        <InspectorRow
                          label={t('inspector.text')}
                          value={selection.text.length > 60 ? selection.text.slice(0, 60) + '…' : selection.text}
                        />
                      )}
                      <InspectorRow
                        label={t('inspector.translate')}
                        value={selection.translate || t('inspector.placeholder')}
                        muted={!selection.translate}
                      />
                      <InspectorRow
                        label={t('inspector.scale')}
                        value={selection.scale || t('inspector.placeholder')}
                        muted={!selection.scale}
                      />
                    </div>
                  )}
                </div>

                {/* Change list */}
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="hds-inspector-label">{t('changes.label')}</span>
                    {changes.length > 0 && (
                      <span className="text-[10px] font-mono text-[var(--tertiary-label)] tabular-nums">
                        {changes.length}
                      </span>
                    )}
                  </div>
                  {changes.length === 0 ? (
                    <p className="text-xs text-[var(--tertiary-label)]">{t('changes.none')}</p>
                  ) : (
                    <ul className="space-y-1">
                      {changes.map((c) => (
                        <li key={c.tweakId}>
                          <button
                            onClick={() => handleFocusElement(c.tweakId)}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--control-bg)] transition-colors group"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-[var(--tertiary-label)] shrink-0">
                                {c.kinds.map((k) => k === 'text' ? '✎' : k === 'move' ? '↗' : '⊕').join(' ')}
                              </span>
                              <span className="text-[11px] text-[var(--label)] truncate group-hover:text-[var(--system-blue)]">
                                {c.preview || c.tagName}
                              </span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-[var(--label)] text-[var(--window-bg)] text-xs font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  onPick,
  onTrySample,
  loading,
  error,
  t,
}: {
  onPick: () => void;
  onTrySample: () => void;
  loading: boolean;
  error: string | null;
  t: TFunction<'htmlWorkbench'>;
}) {
  const chips = t('page.chips', { returnObjects: true }) as string[];
  const abilities = t('page.abilities', { returnObjects: true }) as { title: string; desc: string }[];

  // Three SVG glyphs, one per ability — kept inline to avoid a new icon dep.
  const abilityIcons = [
    // 0: animations kept — a pulse / heartbeat glyph
    <svg key="0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12h4l2-6 4 12 2-6h8" />
    </svg>,
    // 1: click to edit / drag to move — cursor on a frame
    <svg key="1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M12 8v8M8 12h8" />
    </svg>,
    // 2: clean HTML export — </>
    <svg key="2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="8 7 3 12 8 17" />
      <polyline points="16 7 21 12 16 17" />
      <line x1="13" y1="5" x2="11" y2="19" />
    </svg>,
  ];

  return (
    <div
      className="flex-1 flex items-center justify-center p-6 sm:p-10 hds-cinema hds-empty-wrap"
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('is-drag-active'); }}
      onDragLeave={(e) => { e.currentTarget.classList.remove('is-drag-active'); }}
      onDrop={(e) => { e.currentTarget.classList.remove('is-drag-active'); }}
    >
      <div className="hds-empty-panel">
        <div className="hds-empty-panel-glow" aria-hidden="true" />
        <div className="hds-empty-split">
        {/* Left — value / capability communication. */}
        <div className="hds-empty-value">
          <div className="hds-empty-value-head">
            <span className="hds-empty-pill">main</span>
            <h2 className="hds-empty-title">{t('page.title')}</h2>
            <p className="hds-empty-subtitle">{t('page.subtitle')}</p>
            <div className="hds-empty-chips">
              {chips.map((c) => <span key={c} className="hds-empty-chip">{c}</span>)}
            </div>
          </div>

          <ul className="hds-empty-abilities">
            {abilities.map((a, i) => (
              <li key={i} className="hds-empty-ability">
                <span className="hds-empty-ability-icon" aria-hidden="true">{abilityIcons[i]}</span>
                <div>
                  <p className="hds-empty-ability-title">{a.title}</p>
                  <p className="hds-empty-ability-desc">{a.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="hds-empty-footnote">{t('page.footnote')}</p>
        </div>

        {/* Right — upload card (dropzone + sample). */}
        <div className="hds-empty-card">
          {/* Window-frame glyph — a mini browser/preview window skeleton.
              Hints at what will render here once an HTML file is dropped in. */}
          <div className="hds-empty-window" aria-hidden="true">
            <div className="hds-empty-window-bar">
              <span className="hds-empty-window-dot" />
              <span className="hds-empty-window-dot" />
              <span className="hds-empty-window-dot" />
              <span className="hds-empty-window-url" />
            </div>
            <div className="hds-empty-window-body">
              <div className="hds-empty-window-line hds-empty-window-line--w70" />
              <div className="hds-empty-window-line hds-empty-window-line--w50" />
              <div className="hds-empty-window-line hds-empty-window-line--w90" />
              <div className="hds-empty-window-line hds-empty-window-line--w40" />
            </div>
          </div>

          {/* Visual anchor — the </> mark, HTML's native glyph. */}
          <div className="hds-empty-glyph" aria-hidden="true">
            <span className="hds-empty-glyph-lt">&lt;</span>
            <span className="hds-empty-glyph-slash">/</span>
            <span className="hds-empty-glyph-gt">&gt;</span>
          </div>

          {error && (
            <p className="hds-empty-error">{error}</p>
          )}

          {/* Dropzone — viewfinder corners replace the clichéd dashed border.
              The whole card is the target; the corners focus the eye. */}
          <div
            className="hds-empty-dropzone"
            onClick={() => { if (!loading) onPick(); }}
            role="button"
            tabIndex={0}
            aria-disabled={loading}
          >
            {/* Four L-shaped corner accents — viewfinder framing. */}
            <span className="hds-empty-corner hds-empty-corner--tl" aria-hidden="true" />
            <span className="hds-empty-corner hds-empty-corner--tr" aria-hidden="true" />
            <span className="hds-empty-corner hds-empty-corner--bl" aria-hidden="true" />
            <span className="hds-empty-corner hds-empty-corner--br" aria-hidden="true" />

            <p className="hds-empty-drop-title">
              {loading ? t('page.loading') : t('page.empty')}
              {!loading && <span className="hds-empty-caret" aria-hidden="true">_</span>}
            </p>
            <button
              type="button"
              disabled={loading}
              tabIndex={-1}
              aria-hidden="true"
              className="hds-empty-browse"
            >
              {t('page.browse')}
            </button>
          </div>

          {/* Secondary action — link, not button. Same visual weight as footnote. */}
          <button
            onClick={onTrySample}
            disabled={loading}
            className="hds-empty-sample"
          >
            {t('page.trySample')}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="hds-empty-sample-arrow"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

function InspectorRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--tertiary-label)] mb-1">
        {label}
      </div>
      <div className={`text-xs font-mono break-all ${muted ? 'text-[var(--tertiary-label)]' : 'text-[var(--label)]'}`}>
        {value}
      </div>
    </div>
  );
}
