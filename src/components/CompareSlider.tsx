import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { pointerPercent, sliderKey } from '@/lib/slider'

/**
 * Before/after wipe over one photo. The "after" image is revealed from the
 * divider to the right edge. Drag anywhere on the photo, or focus the handle
 * and use the arrow keys, Page Up/Down, Home and End.
 */
export function CompareSlider({
  before,
  after,
  label,
  beforeLabel = 'Original',
  afterLabel = 'With message',
}: {
  before: string
  after: string
  /** Accessible name of the slider. */
  label: string
  beforeLabel?: string
  afterLabel?: string
}) {
  const [position, setPosition] = useState(50)
  const [ratio, setRatio] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  function moveTo(clientX: number) {
    const box = boxRef.current?.getBoundingClientRect()
    if (box) setPosition(pointerPercent(clientX, box.left, box.width))
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    moveTo(e.clientX)
    handleRef.current?.focus({ preventScroll: true })
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragging.current) moveTo(e.clientX)
  }

  function onPointerEnd() {
    dragging.current = false
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next = sliderKey(position, e.key, e.shiftKey)
    if (next === null) return
    e.preventDefault()
    setPosition(next)
  }

  return (
    // The frame is a size container, so the photo box can be fitted to the
    // photo's own aspect ratio and the divider never runs into the letterbox.
    <div className="absolute inset-0 grid place-items-center p-3 sm:p-5" style={{ containerType: 'size' }}>
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="relative cursor-ew-resize touch-pan-y select-none"
        style={
          ratio
            ? { aspectRatio: ratio, width: `min(100cqw, calc(100cqh * ${ratio}))` }
            : { width: '100cqw', height: '100cqh' }
        }
      >
        <img
          src={before}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget
            if (w && h) setRatio(w / h)
          }}
          className="absolute inset-0 size-full object-contain"
        />
        <img
          src={after}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-contain"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        />

        <span className="readout pointer-events-none absolute top-2 left-2 rounded-full bg-background/80 px-2.5 py-1 text-foreground backdrop-blur-sm sm:top-3 sm:left-3">
          {beforeLabel}
        </span>
        <span className="readout pointer-events-none absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-primary backdrop-blur-sm sm:top-3 sm:right-3">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          {afterLabel}
        </span>

        {/* Divider and handle. The handle is the focusable slider. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-primary shadow-[0_0_0_1px_rgb(13_14_12/0.35)]"
          style={{ left: `${position}%` }}
        />
        <div
          ref={handleRef}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={position}
          aria-valuetext={`${position}% ${beforeLabel.toLowerCase()}, ${100 - position}% ${afterLabel.toLowerCase()}`}
          onKeyDown={onKeyDown}
          className="absolute top-1/2 grid size-10 -translate-1/2 place-items-center rounded-full border border-primary bg-background/85 text-primary shadow-lg backdrop-blur-sm transition-transform duration-150 hover:scale-105 focus-visible:outline-offset-2"
          style={{ left: `${position}%` }}
        >
          <svg aria-hidden="true" viewBox="0 0 20 12" className="w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1 1 6l5 5M14 1l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}
