import type { ReactNode } from 'react'

/**
 * Short hero over the darkroom photo. The photo is low emphasis (dimmed and
 * scrimmed); the headline sits on its dark right side.
 */
export function Hero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string
  title: string
  lede: string
  children?: ReactNode
}) {
  return (
    <section className="hero relative isolate overflow-hidden rounded-2xl border border-black/10 dark:border-white/[0.06]">
      <img
        src="/hero.webp"
        alt=""
        width={2048}
        height={1140}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 -z-20 size-full object-cover object-[22%_50%] opacity-75 lg:object-center lg:opacity-80"
      />
      <div aria-hidden="true" className="hero-scrim absolute inset-0 -z-10" />

      <div className="flex min-h-[22rem] flex-col justify-end px-5 pt-28 pb-6 sm:min-h-[24rem] sm:px-9 sm:pb-9 lg:ml-auto lg:min-h-[25rem] lg:w-[54%] lg:justify-center lg:py-12 lg:pr-12 lg:pl-0">
        <p className="readout text-[#ffb547]">{eyebrow}</p>
        <h1 className="mt-4 font-display text-display text-[var(--hero-fg)]">{title}</h1>
        <p className="mt-4 max-w-[42ch] text-[0.9375rem] leading-relaxed text-[var(--hero-muted)] sm:text-base">
          {lede}
        </p>
        {children ? <div className="mt-6">{children}</div> : null}
      </div>

      <p
        aria-hidden="true"
        className="readout absolute top-5 left-5 hidden text-white/45 sm:block sm:left-9 sm:top-7"
      >
        Fig. 01 · Safelight
      </p>
    </section>
  )
}
