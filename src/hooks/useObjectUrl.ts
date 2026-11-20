import { useEffect, useState } from 'react'

/** An object URL for `blob`, revoked when the blob changes or on unmount. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null)

  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    // An object URL is an external resource that must be created and revoked
    // in pairs, so it lives in an effect (StrictMode-safe) rather than render.
    // oxlint-disable-next-line react/set-state-in-effect
    setEntry({ blob, url })
    return () => URL.revokeObjectURL(url)
  }, [blob])

  // Only hand out the URL that belongs to the current blob.
  return blob && entry?.blob === blob ? entry.url : null
}
