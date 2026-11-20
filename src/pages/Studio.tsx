import { NavLink } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { cn } from '@/lib/utils'

export type StudioMode = 'hide' | 'reveal'

const COPY: Record<StudioMode, { eyebrow: string; title: string; lede: string; doc: string }> = {
  hide: {
    eyebrow: 'Hide',
    title: 'Hide a message inside a photo.',
    lede: 'Your message is encrypted with a password and woven into the picture itself. Runs entirely in your browser. Nothing is uploaded.',
    doc: 'Hide a message inside a photo · steg.mss.io',
  },
  reveal: {
    eyebrow: 'Reveal',
    title: 'Reveal a hidden message.',
    lede: 'Drop in a photo made here and enter its password. The message is read on this device and never leaves it.',
    doc: 'Reveal a hidden message · steg.mss.io',
  },
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-full px-4 py-1.5 text-sm transition-colors',
    isActive
      ? 'bg-foreground text-background'
      : 'text-muted-foreground hover:text-foreground',
  )

// Placeholder: Task 7 builds the real studio (stage, controls, results).
export function Studio({ mode }: { mode: StudioMode }) {
  const copy = COPY[mode]

  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
      <title>{copy.doc}</title>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title}>
        <p>{copy.lede}</p>
      </PageHeader>

      <nav
        aria-label="Mode"
        className="mt-10 inline-flex rounded-full border border-border-strong p-1"
      >
        <NavLink to="/" end className={tabClass}>
          Hide
        </NavLink>
        <NavLink to="/reveal" className={tabClass}>
          Reveal
        </NavLink>
      </nav>

      <div className="mt-8 grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-border-strong bg-card/40 sm:aspect-[16/7]">
        <p className="readout text-muted-foreground">Studio · coming next</p>
      </div>
    </div>
  )
}
