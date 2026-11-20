import type { ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import { CompareSlider } from '@/components/CompareSlider'
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

/**
 * The photo: an empty dropzone, then a preview with a technical caption.
 * After a hide, the preview becomes a before/after compare slider.
 */
export function ImageStage({
  image,
  result,
  diffUrl,
  tools,
  working,
  workingLabel = 'Encoding',
  error,
  onFile,
  onSample,
  onError,
  onClear,
}: {
  image: LoadedImage | null
  /** The output photo once a hide has finished; compared against the original. */
  result: StageResult | null
  /** The amplified difference image, shown on the "after" side when set. */
  diffUrl?: string | null
  /** Controls shown under the frame (the difference toggle). */
  tools?: ReactNode
  working: boolean
  /** Readout on the photo while working. */
  workingLabel?: string
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
        {image && result ? (
          <CompareSlider
            before={image.url}
            after={diffUrl ?? result.url}
            label="Compare the original with your photo"
            afterLabel={diffUrl ? 'Difference ×8' : 'With message'}
          />
        ) : image && shown ? (
          <>
            <img
              src={shown.url}
              alt="Your photo"
              className={cn(
                'absolute inset-0 size-full object-contain p-3 transition-opacity duration-200 sm:p-5',
                working && 'opacity-80',
              )}
            />
            {working ? <Scanline /> : null}
            {working ? (
              <p className="readout absolute top-3 right-3 rounded-full bg-background/80 px-2.5 py-1 text-foreground backdrop-blur-sm sm:top-4 sm:right-4">
                {workingLabel}
              </p>
            ) : null}
          </>
        ) : (
          <Dropzone onFile={onFile} />
        )}
        {image && dragging ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/70 backdrop-blur-sm">
            <p className="font-display text-[2rem]">Let go to replace it</p>
          </div>
        ) : null}
      </div>

      {image && result && tools ? tools : null}

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
