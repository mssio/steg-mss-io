/** Amber sweep over the photo while working. Hidden entirely under reduced motion. */
export function Scanline() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      <div className="scanline" />
    </div>
  )
}
