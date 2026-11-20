import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon, EraserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { codePoints } from '@/lib/format'

/** Split into user-perceived characters so emoji and accents fade in whole. */
function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment)
  }
  return Array.from(text)
}

/**
 * The text "develops" a character at a time. Purely visual: the animated copy
 * is hidden from assistive tech, which reads the full text from an sr-only
 * twin. Under reduced motion it appears at once.
 */
function Typewriter({ text }: { text: string }) {
  const chars = graphemes(text)
  const step = Math.min(28, 1400 / Math.max(1, chars.length))
  return (
    <>
      <span aria-hidden="true">
        {chars.map((c, i) => (
          <span key={i} className="type-in" style={{ animationDelay: `${Math.round(i * step)}ms` }}>
            {c}
          </span>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </>
  )
}

/** The revealed message (or the empty frame it develops into), with Copy and Clear. */
export function RevealedMessage({ message, onClear }: { message: string | null; onClear: () => void }) {
  const [copiedFor, setCopiedFor] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copied = message !== null && copiedFor === message

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [message])

  async function copy() {
    const current = message
    if (current === null) return
    try {
      await navigator.clipboard.writeText(current)
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      setCopiedFor(current)
      toast.success('Message copied')
      timerRef.current = setTimeout(() => {
        setCopiedFor((prev) => (prev === current ? null : prev))
        timerRef.current = null
      }, 1600)
    } catch {
      toast('Couldn’t copy', { description: 'Select the text and copy it instead.' })
    }
  }

  return (
    <div aria-live="polite">
      {message === null ? (
        <div className="crop-marks grid min-h-40 place-items-center rounded-xl border border-dashed border-border-strong px-6 py-10 text-center">
          <div className="space-y-2">
            <p className="font-display text-[1.625rem] leading-none text-muted-foreground">The message develops here.</p>
            <p className="readout text-muted-foreground">Read on this device only</p>
          </div>
        </div>
      ) : (
        <section
          aria-labelledby="revealed-title"
          className="animate-in fade-in-0 slide-in-from-bottom-1 rounded-xl border border-border-strong bg-card duration-200"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <h2 id="revealed-title" className="flex items-center gap-2 text-sm font-medium">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              Hidden message
            </h2>
            <p className="readout text-muted-foreground">{codePoints(message)} chars</p>
          </div>

          <p className="px-5 pt-5 pb-6 font-display text-[1.625rem] leading-[1.25] break-words whitespace-pre-wrap sm:text-[1.875rem]">
            <Typewriter key={message} text={message} />
          </p>

          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3.5">
            <button
              type="button"
              onClick={copy}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              {copied ? (
                <CheckIcon aria-hidden="true" strokeWidth={2} className="size-4" />
              ) : (
                <CopyIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong px-3.5 text-sm transition-colors hover:bg-muted"
            >
              <EraserIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
              Clear
            </button>
            <p className="readout ml-auto text-muted-foreground max-sm:hidden">Not stored anywhere</p>
          </div>
        </section>
      )}
    </div>
  )
}
