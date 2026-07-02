import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Person = {
  name: string;
  role: string;
  quote: string;
  scene: string;
  tags: string[];
};

/** Avatars are AI-generated anime portraits, kept in the same order as the
 *  i18n `parallel.people` array. */
const AVATARS = [
  '/parallel/luoyonghao.png',
  '/parallel/huyanbin.png',
  '/parallel/jobs.png',
  '/parallel/musk.png',
  '/parallel/jensen.png',
  '/parallel/allenzhang.png',
];

function Avatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    // Fallback when an avatar is missing or generation was refused.
    return (
      <div className="grid h-full w-full place-items-center bg-[rgba(139,147,232,0.14)] text-base font-semibold text-[#c7cbf6]">
        {name.slice(0, 1)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      width={512}
      height={512}
      onError={() => setFailed(true)}
    />
  );
}

export function ParallelBackstage() {
  const { t } = useTranslation('landing');
  const people = t('parallel.people', { returnObjects: true }) as Person[];
  const tag = t('parallel.tag');
  const pass = t('parallel.pass');

  return (
    <section id="parallel" className="relative px-6 py-20 lg:py-28 scroll-mt-20">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="reveal-pass hds-fig-label">{t('parallel.eyebrow')}</p>
          <h2 className="reveal-pass mt-3 text-3xl font-bold leading-tight tracking-tight text-[var(--label)] lg:text-[2.5rem]">
            {t('parallel.titleA')}
            <span className="hds-hero-accent">{t('parallel.titleAccent')}</span>
          </h2>
          <p className="reveal-pass mt-3 text-[15px] text-[var(--secondary-label)]">
            {t('parallel.subtitle')}
          </p>
        </div>

        {/* Desktop: 3-col grid · Mobile: horizontal scroll-snap */}
        <div className="-mx-6 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0">
          {people.map((p, i) => (
            <article
              key={i}
              className="reveal-pass hds-pass-card w-[82%] shrink-0 snap-center p-5 sm:w-[58%] md:w-auto"
            >
              <div className="flex items-center justify-between">
                <span className="hds-pass-tag">{tag}</span>
                <span className="hds-pass-code">{pass}</span>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="hds-pass-avatar h-16 w-16 shrink-0">
                  <Avatar src={AVATARS[i]} name={p.name} />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold text-[var(--label)]">{p.name}</h3>
                  <p className="mt-0.5 text-xs leading-snug text-[var(--secondary-label)]">{p.role}</p>
                </div>
              </div>

              <blockquote className="mt-4 text-[14px] leading-relaxed text-[var(--label)]">
                <span className="hds-hero-accent">“</span>
                {p.quote}
                <span className="hds-hero-accent">”</span>
              </blockquote>

              <p className="mt-3 text-xs italic leading-relaxed text-[var(--tertiary-label)]">
                {p.scene}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.tags.map((tg, j) => (
                  <span key={j} className="hds-pass-pill">{tg}</span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <p className="reveal-pass mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-[var(--tertiary-label)]">
          {t('parallel.disclaimer')}
        </p>
      </div>
    </section>
  );
}
