import { useState } from 'react'
import { cn } from '@/lib/utils'

const SAMPLES = [
  { file: 'landscape.jpg', label: 'Landscape' },
  { file: 'still-life.jpg', label: 'Still life' },
  { file: 'street.jpg', label: 'Street' },
] as const

/** "Try a sample": loads one of the bundled photos (same origin). */
export function SampleChips({
  onPick,
  onError,
  current,
}: {
  onPick: (blob: Blob, name: string) => Promise<void>
  onError: (message: string) => void
  current?: string
}) {
  const [busy, setBusy] = useState<string | null>(null)

  async function pick(file: string) {
    setBusy(file)
    try {
      const res = await fetch(`/samples/${file}`)
      if (!res.ok) throw new Error()
      await onPick(await res.blob(), file)
    } catch (err) {
      onError(err instanceof Error && err.message ? err.message : 'Couldn’t load the sample. Try again.')
    } finally {
      setBusy(null)
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
                    busy === file && 'animate-pulse bg-primary',
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
