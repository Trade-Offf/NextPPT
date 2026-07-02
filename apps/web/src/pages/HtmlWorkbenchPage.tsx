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
import { useNavigate } from 'react-router-dom';
import type { ChangeSummary, LiveHostMessage, LiveRuntimeMessage } from '@hds/protocol';
import { SiteHeader } from '../components/SiteHeader.js';
import { LiveFrame } from '../components/LiveFrame.js';
import { pickFile } from '../fs/adapter.js';
import { useLocalePrefix } from '../hooks/useGuideNav.js';

interface Selection {
  tweakId: string;
  tagName: string;
  text?: string;
  translate?: string;
  scale?: string;
}

export function HtmlWorkbenchPage() {
  const { t } = useTranslation('htmlWorkbench');
  const navigate = useNavigate();
  const prefix = useLocalePrefix();
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
      className="min-h-screen flex flex-col hds-html-workbench"
      style={{
        // Linear-style metallic steel-blue accent for the HTML workbench only.
        // Overrides the global --system-blue (violet) in this subtree so the
        // page reads as cool/metallic instead of "AI purple".
        ['--system-blue' as string]: '#5b6b8c',
        ['--system-blue-press' as string]: '#4a5874',
        ['--cobalt-lt' as string]: 'rgba(91, 107, 140, 0.12)',
      }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <SiteHeader alwaysScrolled trailing={
        <button
          onClick={() => navigate(prefix || '/')}
          className="hds-btn px-3 py-1.5 text-xs"
        >
          {t('page.backHome')}
        </button>
      } />

      <main className="flex-1 flex flex-col">
        {!sourceHtml ? (
          <EmptyState onPick={loadFile} loading={loading} error={error} t={t} />
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
  loading,
  error,
  t,
}: {
  onPick: () => void;
  loading: boolean;
  error: string | null;
  t: TFunction<'htmlWorkbench'>;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--control-bg)] grid place-items-center mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--secondary-label)]">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M9 13l2 2 4-4" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-[var(--label)] mb-2">
          {t('page.title')}
        </h2>
        <p className="text-sm text-[var(--secondary-label)] mb-1">
          {t('page.empty')}
        </p>
        <p className="text-xs text-[var(--tertiary-label)] mb-6">
          {t('page.emptyHint')}
        </p>
        {error && (
          <p className="text-xs text-red-500 mb-4">{error}</p>
        )}
        <button
          onClick={onPick}
          disabled={loading}
          className="hds-btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
        >
          {loading ? t('page.loading') : t('page.pickFile')}
        </button>
        <p className="text-xs text-[var(--tertiary-label)] mt-3">
          {t('page.dragHint')}
        </p>
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
