import { useEffect, useState } from 'react'
import { DiffToggle } from '@/components/DiffToggle'
import { Hero } from '@/components/Hero'
import { HidePanel, HideButton } from '@/components/HidePanel'
import { HideResultCard } from '@/components/HideResultCard'
import { ImageStage } from '@/components/ImageStage'
import { ModeSwitch } from '@/components/ModeSwitch'
import { PrivacyBadge } from '@/components/PrivacyBadge'
import { RevealButton, RevealPanel } from '@/components/RevealPanel'
import { RevealedMessage } from '@/components/RevealedMessage'
import { StickyActionBar } from '@/components/StickyActionBar'
import { useLoadedImage, type ImageSource } from '@/hooks/useLoadedImage'
import { useObjectUrl } from '@/hooks/useObjectUrl'
import { useRun } from '@/hooks/useRun'
import { capacityState, codePoints, stegFileName } from '@/lib/format'
import { capacityDetail, diffPreview, hide, reveal, warm } from '@/lib/steg-client'
import type { CapacityDetail, HideOutput } from '@/lib/steg-types'

export type StudioMode = 'hide' | 'reveal'

const COPY: Record<StudioMode, { eyebrow: string; title: string; lede: string; doc: string }> = {
  hide: {
    eyebrow: 'Hidden in plain sight',
    title: 'Hide a message inside a photo.',
    lede: 'Your words are encrypted with a password and woven into the picture itself. At a glance it looks like an ordinary photo, and only the password can read it.',
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

  // Pre-load the worker and WASM module on mount so the studio works offline after page load.
  useEffect(() => {
    void warm().catch(() => {})
  }, [])

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
      {mode === 'hide' ? <HideStudio /> : <RevealStudio />}
    </div>
  )
}

interface Tagged<T> {
  value: T
  /** The image the work was done for; a result only counts while it is still loaded. */
  source: Blob
}

function HideStudio() {
  const { image, load, loadFrom, clear } = useLoadedImage()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const cap = useRun<Tagged<CapacityDetail>>()
  const job = useRun<Tagged<HideOutput>>()
  const diff = useRun<Tagged<Blob>>()
  /** The result the difference view is switched on for (so a new result starts with it off). */
  const [diffFor, setDiffFor] = useState<Blob | null>(null)
  const { run: runCapacity, reset: resetCapacity } = cap
  const { reset: resetJob } = job
  const { reset: resetDiff } = diff

  // A new (or no) photo: drop any result or work in flight, and measure it.
  useEffect(() => {
    resetJob()
    resetDiff()
    if (!image) {
      resetCapacity()
      return
    }
    const source = image.blob
    runCapacity(async () => ({ value: await capacityDetail(source), source }))
  }, [image, resetJob, resetDiff, resetCapacity, runCapacity])

  const current = image?.blob
  const capacityMax = cap.status === 'done' && cap.result && cap.result.source === current ? cap.result.value : null
  const capacityError = cap.status === 'error' ? (cap.error ?? null) : null
  const measuring = image !== null && capacityMax === null && cap.status !== 'error'
  const output = job.status === 'done' && job.result && job.result.source === current ? job.result.value : null
  const working = job.status === 'running'
  const resultUrl = useObjectUrl(output?.blob)

  // The difference image is computed once per result and kept while it stands.
  const diffOn = output !== null && diffFor === output.blob
  const diffBlob = diff.status === 'done' && diff.result && output && diff.result.source === output.blob ? diff.result.value : null
  const diffUrl = useObjectUrl(diffBlob)
  const diffLoading = diffOn && diff.status === 'running'
  const diffError = diffOn && diff.status === 'error' ? (diff.error ?? null) : null

  const capAssessment = capacityMax ? capacityState(message, capacityMax) : null
  const chars = capAssessment ? capAssessment.chars : codePoints(message)

  let blocker: string | null = null
  if (!image) blocker = 'Choose a photo to start.'
  else if (measuring) blocker = 'Measuring the photo…'
  else if (capacityMax === null) blocker = 'Choose another photo.'
  else if (chars === 0) blocker = 'Write a message.'
  else if (capAssessment?.over) {
    blocker =
      capAssessment.chars > capacityMax.chars
        ? `This image can hold at most ${capacityMax.chars} characters.`
        : `This message is too long for this image (max ${capacityMax.bytes} bytes).`
  }
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

  async function loadSample(source: ImageSource) {
    setLoadError(null)
    try {
      await loadFrom(source)
    } catch (err) {
      setLoadError(err instanceof Error && err.message ? err.message : 'Couldn’t load the sample. Try again.')
    }
  }

  function onClear() {
    setLoadError(null)
    clear()
  }

  // The photo no longer holds what the box says: drop the result (and its
  // difference view) rather than offer a download that doesn't match.
  function onMessage(value: string) {
    if (working) return
    setMessage(value)
    if (job.status !== 'idle') resetJob()
    if (diff.status !== 'idle') resetDiff()
    setDiffFor(null)
  }

  function onToggleDiff() {
    if (!output || !image) return
    if (diffOn) {
      setDiffFor(null)
      return
    }
    setDiffFor(output.blob)
    const cached = diff.status === 'done' && diff.result?.source === output.blob
    if (cached || diff.status === 'running') return
    const original = image.blob
    const stego = output.blob
    diff.run(async () => ({ value: await diffPreview(original, stego), source: stego }))
  }

  function onPassword(value: string) {
    if (working) return
    setPassword(value)
  }

  function onHide() {
    if (!image || blocker !== null || working) return
    const source = image.blob
    const typed = password
    // Any difference view belongs to the previous result.
    resetDiff()
    setDiffFor(null)
    job.run(async () => {
      try {
        return { value: await hide(source, message, typed), source }
      } finally {
        // Never keep the password around after a run, success or failure.
        setPassword('')
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
          diffUrl={diffOn ? diffUrl : null}
          tools={<DiffToggle on={diffOn} loading={diffLoading} error={diffError} onToggle={onToggleDiff} />}
          working={working}
          error={loadError ?? capacityError}
          onFile={(file) => loadImage(file, file.name)}
          onSample={loadSample}
          onClear={onClear}
        />

        <HidePanel
          message={message}
          onMessage={onMessage}
          password={password}
          onPassword={onPassword}
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

function RevealStudio() {
  const { image, load, loadFrom, clear } = useLoadedImage()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const job = useRun<Tagged<string>>()
  const { reset: resetJob } = job

  // A new (or no) photo: drop any message or work in flight.
  useEffect(() => {
    resetJob()
  }, [image, resetJob])

  const current = image?.blob
  const message = job.status === 'done' && job.result && job.result.source === current ? job.result.value : null
  const working = job.status === 'running'
  const error = job.status === 'error' ? (job.error ?? null) : null

  let blocker: string | null = null
  if (!image) blocker = 'Choose a photo to start.'
  else if (!password) blocker = 'Enter the password.'

  async function loadImage(blob: Blob, name: string) {
    setLoadError(null)
    try {
      await load(blob, name)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Couldn’t open that file.')
    }
  }

  async function loadSample(source: ImageSource) {
    setLoadError(null)
    try {
      await loadFrom(source)
    } catch (err) {
      setLoadError(err instanceof Error && err.message ? err.message : 'Couldn’t load the sample. Try again.')
    }
  }

  function onClear() {
    setLoadError(null)
    clear()
  }

  function onPassword(value: string) {
    if (working) return
    setPassword(value)
  }

  function onReveal() {
    if (!image || blocker !== null || working) return
    const source = image.blob
    const typed = password
    job.run(async () => {
      try {
        return { value: await reveal(source, typed), source }
      } finally {
        // Never keep the password around after a run, success or failure.
        setPassword('')
      }
    })
  }

  return (
    <div className="mt-6 sm:mt-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <ImageStage
          image={image}
          result={null}
          working={working}
          workingLabel="Decoding"
          error={loadError}
          onFile={(file) => loadImage(file, file.name)}
          onSample={loadSample}
          onClear={onClear}
        />

        <RevealPanel
          password={password}
          onPassword={onPassword}
          blocker={blocker}
          working={working}
          error={error}
          quiet={message !== null}
          onReveal={onReveal}
        >
          {/* Clear wipes the message from state, not just from view. */}
          <RevealedMessage message={message} onClear={resetJob} />
        </RevealPanel>
      </div>

      <StickyActionBar>
        <RevealButton disabled={blocker !== null || working} working={working} onClick={onReveal} />
      </StickyActionBar>
    </div>
  )
}
