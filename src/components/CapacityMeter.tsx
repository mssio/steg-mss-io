import { meterState, type MeterState } from '@/lib/format'
import { cn } from '@/lib/utils'

const FILL: Record<MeterState, string> = {
  ok: 'bg-foreground/70',
  near: 'bg-primary',
  over: 'bg-destructive',
}

const TEXT: Record<MeterState, string> = {
  ok: 'text-muted-foreground',
  near: 'text-primary',
  over: 'text-destructive',
}

/**
 * How much of the photo's room the message uses: `128 / 412 chars`, plus
 * `· 300 / 412 bytes` once the text has multi-byte characters. The core has
 * the final word on bytes (see HidePanel).
 */
export function CapacityMeter({
  chars,
  bytes,
  max,
  pending,
}: {
  chars: number
  bytes: number
  /** Characters the photo can hold; null until a photo is measured. */
  max: number | null
  pending: boolean
}) {
  if (max === null) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div aria-hidden="true" className="h-1 flex-1 rounded-full bg-muted" />
        <p className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {pending ? 'Measuring the photo…' : `${chars} chars · no photo yet`}
        </p>
      </div>
    )
  }

  const state = meterState(chars, max)
  const byteState = meterState(bytes, max)
  const showBytes = bytes > chars
  const pct = max > 0 ? Math.min(100, (chars / max) * 100) : 100

  return (
    <div className="flex items-center justify-between gap-3">
      <div
        role="meter"
        aria-label="Message length"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(chars, max)}
        aria-valuetext={`${chars} of ${max} characters${state === 'over' ? ', too long' : ''}`}
        className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width,background-color] duration-200', FILL[state])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="shrink-0 font-mono text-xs tabular-nums">
        <span className={TEXT[state]}>
          {chars} / {max} chars
        </span>
        {showBytes ? (
          <span className={TEXT[byteState]}>
            {' '}
            · {bytes} / {max} bytes
          </span>
        ) : null}
      </p>
    </div>
  )
}
