import { useEffect, useState } from 'react'
import { Hero } from '@/components/Hero'
import { HidePanel, HideButton } from '@/components/HidePanel'
import { HideResultCard } from '@/components/HideResultCard'
import { ImageStage } from '@/components/ImageStage'
import { ModeSwitch } from '@/components/ModeSwitch'
import { PrivacyBadge } from '@/components/PrivacyBadge'
import { StickyActionBar } from '@/components/StickyActionBar'
import { useLoadedImage } from '@/hooks/useLoadedImage'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { useRun } from '@/hooks/useRun'
import { codePoints, stegFileName, utf8Bytes } from '@/lib/format'
import { capacity, hide } from '@/lib/steg-client'
import type { HideOutput } from '@/lib/steg-types'

export type StudioMode = 'hide' | 'reveal'

const COPY: Record<StudioMode, { eyebrow: string; title: string; lede: string; doc: string }> = {
  hide: {
    eyebrow: 'Hidden in plain sight',
    title: 'Hide a message inside a photo.',
    lede: 'Your words are encrypted with a password and woven into the picture itself. To anyone else it is just a photo.',
    doc: 'Hide a message inside a photo · steg.mss.io',
  },
  reveal: {
    eyebrow: 'Hidden in plain sight',
    title: 'Reveal a hidden message.',
    lede: 'Drop in a photo made here and enter its password. The message is read on this device and never leaves it.',
    doc: 'Reveal a hidden message · steg.mss.io',
  },
}

export function Studio({ mode }: { mode: StudioMode }) {
  const copy = COPY[mode]

  return (
    <div className="mx-auto max-w-6xl px-5 pt-5 pb-16 sm:px-8 sm:pt-8 sm:pb-24">
      <title>{copy.doc}</title>
      <Hero eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede}>
        <PrivacyBadge />
      </Hero>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 sm:mt-10">
        <ModeSwitch />
        <p className="readout text-muted-foreground max-sm:hidden">PNG · JPEG · up to 500 characters</p>
      </div>

      {/* Different component types, so switching modes unmounts the other side
          and any work in flight there is dropped. */}
      {mode === 'hide' ? <HideStudio /> : <RevealPlaceholder />}
    </div>
  )
}

interface Tagged<T> {
  value: T
  /** The image the work was done for; a result only counts while it is still loaded. */
  source: Blob
}

function HideStudio() {
  const { image, load, clear } = useLoadedImage()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const cap = useRun<Tagged<number>>()
  const job = useRun<Tagged<HideOutput>>()
  const { run: runCapacity, reset: resetCapacity } = cap
  const { reset: resetJob } = job

  // A new (or no) photo: drop any result or work in flight, and measure it.
  useEffect(() => {
    resetJob()
    if (!image) {
      resetCapacity()
      return
    }
    const source = image.blob
    runCapacity(async () => ({ value: await capacity(source), source }))
  }, [image, resetJob, resetCapacity, runCapacity])

  const current = image?.blob
  const capacityMax = cap.status === 'done' && cap.result && cap.result.source === current ? cap.result.value : null
  const capacityError = cap.status === 'error' ? (cap.error ?? null) : null
  const measuring = cap.status === 'running'
  const output = job.status === 'done' && job.result && job.result.source === current ? job.result.value : null
  const working = job.status === 'running'
  const resultUrl = useObjectUrl(output?.blob)

  const chars = codePoints(message)
  const bytes = utf8Bytes(message)

  let blocker: string | null = null
  if (!image) blocker = 'Choose a photo to start.'
  else if (measuring) blocker = 'Measuring the photo…'
  else if (capacityMax === null) blocker = 'Choose another photo.'
  else if (chars === 0) blocker = 'Write a message.'
  else if (chars > capacityMax) blocker = `This image can hold at most ${capacityMax} characters.`
  else if (!password) blocker = 'Set a password.'

  const status =
    job.status === 'running'
      ? { tone: 'info' as const, text: 'Deriving key…' }
      : job.status === 'error' && job.error
        ? { tone: 'error' as const, text: job.error }
        : output
          ? { tone: 'success' as const, text: 'Message hidden. Download your photo below.' }
          : null

  async function loadImage(blob: Blob, name: string) {
    setLoadError(null)
    try {
      await load(blob, name)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Couldn’t open that file.')
    }
  }

  function onClear() {
    setLoadError(null)
    clear()
  }

  function onHide() {
    if (!image || blocker !== null || working) return
    const source = image.blob
    const typed = password
    job.run(async () => {
      try {
        return { value: await hide(source, message, typed), source }
      } finally {
        // Never keep the password around after a run, success or failure
        // (but don't wipe a new one typed while this run was in flight).
        setPassword((now) => (now === typed ? '' : now))
      }
    })
  }

  const fileName = output ? stegFileName(image?.name ?? '', output.mime) : ''

  return (
    <div className="mt-6 sm:mt-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <ImageStage
          image={image}
          result={
            output && resultUrl
              ? { url: resultUrl, format: output.mime === 'image/png' ? 'PNG' : 'JPEG', size: output.blob.size }
              : null
          }
          working={working}
          error={loadError ?? capacityError}
          onFile={(file) => loadImage(file, file.name)}
          onSample={loadImage}
          onError={setLoadError}
          onClear={onClear}
        />

        <HidePanel
          message={message}
          onMessage={setMessage}
          password={password}
          onPassword={setPassword}
          chars={chars}
          bytes={bytes}
          capacity={capacityMax}
          measuring={measuring}
          blocker={blocker}
          working={working}
          status={status}
          onHide={onHide}
        >
          {output && resultUrl ? (
            <HideResultCard
              blob={output.blob}
              url={resultUrl}
              fileName={fileName}
              blocksUsed={output.blocksUsed}
              blocksTotal={output.blocksTotal}
            />
          ) : null}
        </HidePanel>
      </div>

      <StickyActionBar>
        <HideButton disabled={blocker !== null || working} working={working} onClick={onHide} />
      </StickyActionBar>
    </div>
  )
}

// Task 8 builds the Reveal studio.
function RevealPlaceholder() {
  return (
    <div className="crop-marks mt-6 grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-border-strong bg-card/40 sm:mt-8 sm:aspect-[16/7]">
      <p className="readout text-muted-foreground">Reveal · coming next</p>
    </div>
  )
}
