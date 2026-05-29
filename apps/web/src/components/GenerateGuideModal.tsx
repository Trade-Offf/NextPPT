import { useEffect, useState } from 'react';
import { GENERATE_PROMPT, MANUAL_STEPS } from '../data/generatePrompt.js';

interface GenerateGuideModalProps {
  onClose: () => void;
  onUseTemplate: () => void;
}

export function GenerateGuideModal({ onClose, onUseTemplate }: GenerateGuideModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(GENERATE_PROMPT);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = GENERATE_PROMPT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="hds-modal-backdrop" onClick={onClose}>
      <div
        className="hds-modal"
        role="dialog"
        aria-modal="true"
        aria-label="用 AI 生成演示稿"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="hds-modal-titlebar">
          <button className="hds-modal-close" onClick={onClose} aria-label="关闭" title="关闭">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
          <span className="hds-modal-title">用 AI 生成演示稿</span>
        </div>

        <div className="hds-modal-body">
          <p className="text-sm text-[var(--secondary-label)] leading-relaxed mb-5">
            HTML Deck Studio 负责<strong className="text-[var(--label)]">编辑与导出</strong>，
            前置的内容生成可以交给任意 AI。复制下面这段提示词，几步就能拿到一份可直接打开的演示稿。
          </p>

          {/* Steps */}
          <ol className="hds-steps mb-6">
            {MANUAL_STEPS.map((step, i) => (
              <li key={step.title} className="hds-step">
                <span className="hds-step-num">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--label)] leading-tight">{step.title}</p>
                  <p className="text-xs text-[var(--secondary-label)] leading-relaxed mt-0.5">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Prompt block */}
          <div className="flex items-center justify-between mb-2">
            <span className="hds-inspector-label" style={{ padding: 0 }}>提示词</span>
            <button onClick={copyPrompt} className={`hds-copy-btn ${copied ? 'is-copied' : ''}`}>
              {copied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 4.5" /></svg>
                  已复制
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" strokeLinecap="round" /></svg>
                  复制提示词
                </>
              )}
            </button>
          </div>
          <pre className="hds-code-block"><code>{GENERATE_PROMPT}</code></pre>

          {/* Template shortcut */}
          <div className="mt-5 pt-4 border-t border-[var(--separator)] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-[var(--tertiary-label)]">想先看看效果？</span>
            <button
              onClick={() => { onUseTemplate(); onClose(); }}
              className="text-xs text-[var(--system-blue)] hover:underline font-medium"
            >
              直接用示例模板体验 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
