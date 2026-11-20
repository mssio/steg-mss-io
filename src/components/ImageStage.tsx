import { XIcon } from 'lucide-react'
import { Dropzone } from '@/components/Dropzone'
import { SampleChips } from '@/components/SampleChips'
import { Scanline } from '@/components/Scanline'
import { useFileDrop } from '@/hooks/useFileDrop'
import type { LoadedImage } from '@/hooks/useLoadedImage'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface StageResult {
  url: string
  format: 'PNG' | 'JPEG'
  size: number
}

/** `2048 × 1533 · JPEG · 1.4 MB` */
function caption(width: number, height: number, format: string, size: number) {
  const dims = width && height ? `${width} × ${height} · ` : ''
  return `${dims}${format} · ${formatBytes(size)}`
}

/** The photo: an empty dropzone, then a preview with a technical caption. */
export function ImageStage({
  image,
  result,
  working,
  error,
  onFile,
  onSample,
  onError,
  onClear,
}: {
  image: LoadedImage | null
  /** The output photo once a hide has finished; shown instead of the original. */
  result: StageResult | null
  working: boolean
  error: string | null
  onFile: (file: File) => void
  onSample: (blob: Blob, name: string) => Promise<void>
  onError: (message: string) => void
  onClear: () => void
}) {
  const { dragging, dropProps } = useFileDrop(onFile)
  const shown = result ?? (image ? { url: image.url, format: image.format, size: image.size } : null)

  return (
    <section aria-label="Photo" className="min-w-0 space-y-4">
      <div
        {...(image ? dropProps : {})}
        className={cn(
          'crop-marks relative aspect-[4/3] overflow-hidden rounded-xl border bg-card transition-colors duration-200',
          image ? 'border-border' : 'border-dashed border-border-strong',
          dragging && 'border-primary',
        )}
      >
        {image && shown ? (
          <>
            <img
              src={shown.url}
              alt={result ? 'Your photo, with the message hidden in it' : 'Your photo'}
              className={cn(
                'absolute inset-0 size-full object-contain p-3 transition-opacity duration-200 sm:p-5',
                working && 'opacity-80',
              )}
            />
            {working ? <Scanline /> : null}
            {result ? (
              <p className="readout absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-primary backdrop-blur-sm sm:top-4 sm:left-4">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                Message hidden
              </p>
            ) : null}
            {working ? (
              <p className="readout absolute top-3 right-3 rounded-full bg-background/80 px-2.5 py-1 text-foreground backdrop-blur-sm sm:top-4 sm:right-4">
                Encoding
              </p>
            ) : null}
            {dragging ? (
              <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
                <p className="font-display text-[2rem]">Let go to replace it</p>
              </div>
            ) : null}
          </>
        ) : (
          <Dropzone onFile={onFile} />
        )}
      </div>

      {image && shown ? (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm">{image.name || 'Pasted image'}</p>
            <p className="readout whitespace-nowrap text-muted-foreground">
              {caption(image.width, image.height, shown.format, shown.size)}
            </p>
          </div>
          <div className="-mr-2 flex shrink-0 items-center">
            <Dropzone variant="compact" onFile={onFile} />
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <XIcon aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <SampleChips onPick={onSample} onError={onError} current={image?.name} />
    </section>
  )
}
