import { useMemo } from 'react'
import { CheckIcon, DownloadIcon, Share2Icon } from 'lucide-react'
import { formatBytes } from '@/lib/format'

export const DELIVERY_TIP =
  'Send as a file or document on WhatsApp/Telegram for the best chance the message survives.'

/** The finished photo: download, share (where the platform can share files), and how to send it. */
export function HideResultCard({
  blob,
  url,
  fileName,
  blocksUsed,
  blocksTotal,
}: {
  blob: Blob
  url: string
  fileName: string
  blocksUsed: number
  blocksTotal: number
}) {
  const file = useMemo(() => new File([blob], fileName, { type: blob.type }), [blob, fileName])
  const canShare = typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] }) === true

  async function share() {
    try {
      await navigator.share({ files: [file] })
    } catch {
      // Dismissed or not allowed: nothing to report.
    }
  }

  return (
    <section
      aria-labelledby="hide-result-title"
      className="animate-in fade-in-0 slide-in-from-bottom-1 rounded-xl border border-border-strong bg-card duration-200"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon aria-hidden="true" strokeWidth={2.5} className="size-3" />
          </span>
          <h2 id="hide-result-title" className="text-sm font-medium">
            Your photo is ready
          </h2>
        </div>

        <div className="space-y-1">
          <p className="font-mono text-sm break-all">{fileName}</p>
          <p className="readout text-muted-foreground">
            {formatBytes(blob.size)} · {blocksUsed.toLocaleString('en')} / {blocksTotal.toLocaleString('en')} blocks
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={url}
            download={fileName}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <DownloadIcon aria-hidden="true" strokeWidth={2} className="size-4" />
            Download
          </a>
          {canShare ? (
            <button
              type="button"
              onClick={share}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm transition-colors hover:bg-muted"
            >
              <Share2Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
              Share
            </button>
          ) : null}
        </div>
      </div>

      <p className="flex gap-3 border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground">
        <span aria-hidden="true" className="readout mt-0.5 shrink-0 text-primary">
          Tip
        </span>
        <span>{DELIVERY_TIP}</span>
      </p>
    </section>
  )
}
