import { useEffect, useRef } from 'react'
import { ImagePlusIcon, RefreshCwIcon } from 'lucide-react'
import { useFileDrop } from '@/hooks/useFileDrop'
import { cn } from '@/lib/utils'

const ACCEPT = 'image/png,image/jpeg'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * Picks a photo by click, drop, or paste anywhere on the page (Ctrl/Cmd+V).
 * `stage` fills the empty image frame; `compact` is the "Replace" button shown
 * once a photo is loaded. Exactly one is mounted, so there is one paste listener.
 */
export function Dropzone({
  onFile,
  variant = 'stage',
}: {
  onFile: (file: File) => void
  variant?: 'stage' | 'compact'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { dragging, dropProps } = useFileDrop(onFile)

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = Array.from(e.clipboardData?.files ?? [])[0]
      if (!file) return // plain text paste: leave it alone
      e.preventDefault()
      onFile(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [onFile])

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      hidden
      tabIndex={-1}
      onChange={(e) => {
        const file = e.currentTarget.files?.[0]
        e.currentTarget.value = '' // picking the same file again still fires
        if (file) onFile(file)
      }}
    />
  )

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          {...dropProps}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            dragging && 'bg-muted text-foreground',
          )}
        >
          <RefreshCwIcon aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
          Replace
        </button>
        {input}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        {...dropProps}
        aria-describedby="dropzone-hint"
        className={cn(
          'group absolute inset-0 flex flex-col items-center justify-center gap-5 rounded-[inherit] px-6 text-center transition-colors duration-200 focus-visible:-outline-offset-2',
          'hover:bg-[var(--safelight)]',
          dragging && 'bg-[var(--safelight)] ring-2 ring-primary ring-inset',
        )}
      >
        <span
          className={cn(
            'grid size-14 place-items-center rounded-full border border-border-strong text-muted-foreground transition-all duration-200',
            'group-hover:border-primary group-hover:text-primary',
            dragging && 'scale-105 border-primary text-primary',
          )}
        >
          <ImagePlusIcon aria-hidden="true" strokeWidth={1.5} className="size-6" />
        </span>
        <span className="space-y-1.5">
          <span className="block font-display text-[1.75rem] leading-none sm:text-[2rem]">
            {dragging ? 'Let go to load it' : 'Drop a photo here'}
          </span>
          <span id="dropzone-hint" className="block text-sm text-muted-foreground">
            or <span className="text-foreground underline decoration-border-strong underline-offset-4 group-hover:decoration-primary">choose a file</span>
            <span className="max-sm:hidden"> · paste with {isMac ? '⌘V' : 'Ctrl+V'}</span>
          </span>
        </span>
        <span className="readout text-muted-foreground">PNG or JPEG · up to 40 MP</span>
      </button>
      {input}
    </>
  )
}
