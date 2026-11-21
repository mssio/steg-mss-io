import { useRef, useState } from 'react'
import type { ImageSource } from '@/hooks/useLoadedImage'
import { cn } from '@/lib/utils'

const SAMPLES = [
  { file: 'landscape.jpg', label: 'Landscape' },
  { file: 'still-life.jpg', label: 'Still life' },
  { file: 'street.jpg', label: 'Street' },
] as const

const SAMPLE_LOAD_ERROR = 'Couldn’t load the sample. Try again.'

/** "Try a sample": loads one of the bundled photos (same origin). */
export function SampleChips({
  onPick,
  current,
}: {
  onPick: (source: ImageSource) => Promise<void>
  current?: string
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const clickSeq = useRef(0)

  async function pick(file: string) {
    const seq = ++clickSeq.current
    setBusy(file)
    try {
      await onPick(async () => {
        let res: Response
        try {
          res = await fetch(`/samples/${file}`)
        } catch {
          throw new Error(SAMPLE_LOAD_ERROR)
        }
        if (!res.ok) throw new Error(SAMPLE_LOAD_ERROR)
        try {
          return { blob: await res.blob(), name: file }
        } catch {
          throw new Error(SAMPLE_LOAD_ERROR)
        }
      })
    } finally {
      if (clickSeq.current === seq) setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p id="samples-label" className="readout text-muted-foreground">
        Try a sample
      </p>
      <ul aria-labelledby="samples-label" className="flex flex-wrap gap-1.5">
        {SAMPLES.map(({ file, label }) => {
          const active = current === file
          return (
            <li key={file}>
              <button
                type="button"
                onClick={() => pick(file)}
                aria-busy={busy === file}
                aria-pressed={active}
                className={cn(
                  'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm transition-colors duration-200',
                  active
                    ? 'border-primary/70 text-foreground'
                    : 'border-border-strong text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 rounded-full transition-colors',
                    active ? 'bg-primary' : 'bg-muted-foreground/50',
                    busy === file && 'animate-pulse bg-primary motion-reduce:animate-none',
                  )}
                />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
