import { capacityState, codePoints, type CapacityLimits, type MeterState } from '@/lib/format'
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
 * How much of the photo's room the message uses: `128 / 500 chars`, plus
 * `· 600 / 1117 bytes` once the text has multi-byte characters.
 */
export function CapacityMeter({
  message,
  capacity,
  pending,
}: {
  message: string
  /** Character and UTF-8 byte limits the photo can hold; null until measured. */
  capacity: CapacityLimits | null
  pending: boolean
}) {
  if (capacity === null) {
    const chars = codePoints(message)
    return (
      <div className="flex items-center justify-between gap-3">
        <div aria-hidden="true" className="h-1 flex-1 rounded-full bg-muted" />
        <p className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {pending ? 'Measuring the photo…' : `${chars} chars · no photo yet`}
        </p>
      </div>
    )
  }

  const { chars, bytes, showBytes, charState, byteState, state, pct, over } = capacityState(
    message,
    capacity,
  )
  const valueText =
    `${chars} of ${capacity.chars} characters` +
    (showBytes ? `, ${bytes} of ${capacity.bytes} bytes` : '') +
    (over ? ', too long' : '')

  return (
    <div className="flex items-center justify-between gap-3">
      <div
        role="meter"
        aria-label="Message length"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={valueText}
        className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width,background-color] duration-200', FILL[state])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="shrink-0 font-mono text-xs tabular-nums">
        <span className={TEXT[charState]}>
          {chars} / {capacity.chars} chars
        </span>
        {showBytes ? (
          <span className={TEXT[byteState]}>
            {' '}
            · {bytes} / {capacity.bytes} bytes
          </span>
        ) : null}
      </p>
    </div>
  )
}
