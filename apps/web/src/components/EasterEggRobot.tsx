import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEasterEggs } from '../hooks/useEasterEggs.js';
import { useOpenDeck } from '../fs/useOpenDeck.js';

const SECRET_CODE = '42';
const MAX_PARTICLES = 600;
const CLICK_THRESHOLD = 7;
const CLICK_WINDOW_MS = 1500;

/**
 * Bit-stream particle burst. Each particle is a "0" or "1" that flies out
 * with gravity + rotation, rendered via Web Animations API (GPU-friendly,
 * zero timer). Sized for visual impact: large glowing monospace glyphs.
 */
function spawnBitParticles(originX: number, originY: number, container: HTMLElement, intensity = 1) {
  const existing = container.querySelectorAll('.easter-bit').length;
  if (existing >= MAX_PARTICLES) return;

  const count = Math.round((14 + Math.floor(Math.random() * 8)) * intensity); // 14-22 per burst
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'easter-bit';
    el.textContent = Math.random() > 0.5 ? '1' : '0';
    // Vary size for depth
    const size = 13 + Math.random() * 14; // 13-27px
    el.style.left = `${originX}px`;
    el.style.top = `${originY}px`;
    el.style.fontSize = `${size}px`;
    container.appendChild(el);

    const angle = Math.random() * Math.PI * 2; // full radial
    const speed = (90 + Math.random() * 220) * intensity;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 60 * intensity; // slight upward bias
    const gravity = 480;
    const duration = 900 + Math.random() * 700;
    const rot = (Math.random() - 0.5) * 1080;
    const t = duration / 1000;
    const dx = vx * t;
    const dy = vy * t + 0.5 * gravity * t * t;

    const anim = el.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg) scale(0.6)`, opacity: 0 },
      ],
      { duration, easing: 'cubic-bezier(0.15, 0.65, 0.4, 1)', fill: 'forwards' },
    );
    anim.onfinish = () => el.remove();
  }
}

/**
 * Tracks rapid logo clicks. Each click fires a "+1s" floating indicator near
 * the logo; reaching CLICK_THRESHOLD within CLICK_WINDOW_MS opens the secret
 * modal. The modal can be re-triggered any number of times.
 */
export function useLogoEasterEgg() {
  const [clickCount, setClickCount] = useState(0);
  const [plusOnes, setPlusOnes] = useState<{ id: number; x: number; y: number }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(0);
  const idRef = useRef(0);

  const handleLogoClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.right - 8;
      const y = rect.top + 4;
      const id = ++idRef.current;
      setPlusOnes((prev) => [...prev, { id, x, y }]);
      setTimeout(() => setPlusOnes((prev) => prev.filter((p) => p.id !== id)), 1100);

      setClickCount((prev) => {
        const next = prev + 1;
        if (next >= CLICK_THRESHOLD) {
          setModalOpen(true);
          return 0;
        }
        return next;
      });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setClickCount(0), CLICK_WINDOW_MS);
    },
    [],
  );

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return {
    clickCount,
    plusOnes,
    modalOpen,
    setModalOpen,
    handleLogoClick,
  };
}

/**
 * Secret code modal + bit-stream particles. Opens after the 7-click unlock.
 * Entering "42" unlocks the terminal theme and triggers a celebration burst.
 */
export function EasterEggModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('editor');
  const { unlockTerminal } = useEasterEggs();
  const navigate = useNavigate();
  const { openTemplateSample } = useOpenDeck();
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const particleLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setInput('');
      setError(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInput(val);
      setError(false);

      // Full-screen bit burst from multiple random origins on every keystroke.
      if (particleLayerRef.current) {
        const W = window.innerWidth;
        const H = window.innerHeight;
        // 3 random eruption points across the screen per keystroke.
        for (let i = 0; i < 3; i++) {
          spawnBitParticles(
            Math.random() * W,
            Math.random() * H,
            particleLayerRef.current,
            1.2,
          );
        }
      }

      if (val === SECRET_CODE) {
        // Screen-wide celebration: dense multi-wave eruption across viewport.
        if (particleLayerRef.current) {
          const W = window.innerWidth;
          const H = window.innerHeight;
          // 14 waves, each spawning 5 eruption points → ~70 bursts total.
          for (let w = 0; w < 14; w++) {
            setTimeout(() => {
              if (!particleLayerRef.current) return;
              for (let i = 0; i < 5; i++) {
                spawnBitParticles(
                  Math.random() * W,
                  Math.random() * H,
                  particleLayerRef.current,
                  1.5,
                );
              }
            }, w * 60);
          }
        }
        // After the celebration, jump into the editor with the terminal template.
        setTimeout(async () => {
          unlockTerminal();
          onClose();
          const ok = await openTemplateSample('/dev-share-deck.html', 'dev-share-deck.html');
          if (ok) navigate('/');
        }, 1200);
      } else if (val.length >= SECRET_CODE.length && val !== SECRET_CODE) {
        setError(true);
      }
    },
    [unlockTerminal, onClose, openTemplateSample, navigate],
  );

  if (!open) return null;

  return (
    <>
      <div
        className="easter-modal-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="easter-modal" role="dialog" aria-modal="true" aria-label={t('easter.modalAria')}>
          <div className="easter-modal-emoji" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="8" width="16" height="12" rx="3" />
              <path d="M12 8V4" />
              <circle cx="12" cy="3" r="1" fill="currentColor" />
              <circle cx="9" cy="13" r="1.2" fill="currentColor" />
              <circle cx="15" cy="13" r="1.2" fill="currentColor" />
              <path d="M9 17h6" />
            </svg>
          </div>
          <h3 className="easter-modal-title">{t('easter.title')}</h3>
          <p className="easter-modal-sub">{t('easter.subtitle')}</p>
          <input
            ref={inputRef}
            className={`easter-modal-input ${error ? 'has-error' : ''}`}
            type="text"
            value={input}
            onChange={handleInput}
            placeholder={t('easter.placeholder')}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
          />
          {error && <p className="easter-modal-error">{t('easter.wrong')}</p>}
          <p className="easter-modal-hint">{t('easter.hint')}</p>
          <button className="easter-modal-close" onClick={onClose}>{t('easter.close')}</button>
        </div>
      </div>
      <div ref={particleLayerRef} className="easter-particle-layer" aria-hidden="true" />
    </>
  );
}
