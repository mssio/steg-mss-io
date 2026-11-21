import { LoaderCircleIcon, ScanSearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DIFF_NOTE = 'The pattern is subtly visible up close — this view amplifies the changes 8×.'

/**
 * "Show difference": swaps the compare slider's "after" side for the amplified
 * difference image. The note is honest that the pattern can be seen.
 */
export function DiffToggle({
  on,
  loading,
  error,
  onToggle,
}: {
  on: boolean
  loading: boolean
  error: string | null
  onToggle: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-sm transition-colors',
          on
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border-strong text-muted-foreground hover:border-foreground/40 hover:text-foreground',
        )}
      >
        {loading ? (
          <LoaderCircleIcon aria-hidden="true" strokeWidth={1.75} className="size-3.5 animate-spin text-primary motion-reduce:animate-none" />
        ) : (
          <ScanSearchIcon aria-hidden="true" strokeWidth={1.75} className={cn('size-3.5', on && 'text-primary')} />
        )}
        Show difference
      </button>
      <p aria-live="polite" className={cn('min-w-0 flex-1 basis-56 text-xs leading-relaxed', error ? 'text-destructive' : 'text-muted-foreground')}>
        {error ?? (loading ? 'Developing the difference…' : on ? DIFF_NOTE : null)}
      </p>
    </div>
  )
}
