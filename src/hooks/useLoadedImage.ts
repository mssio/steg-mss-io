import { useEffect, useState } from 'react'
import { sniffFormat, type ImageFormat } from '@/lib/format'

export interface LoadedImage {
  blob: Blob
  name: string
  /** Object URL for previews; revoked when the image is replaced or cleared. */
  url: string
  /** Decoded dimensions, for the caption only (0 if the browser can't decode it). */
  width: number
  height: number
  format: ImageFormat
  size: number
}

export const UNSUPPORTED_FORMAT = 'Only PNG and JPEG images are supported.'

async function dimensions(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(blob)
    const dims = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dims
  } catch {
    // The core decodes the image itself and reports real problems.
    return { width: 0, height: 0 }
  }
}

export interface ImageLoaderDeps {
  readHead: (blob: Blob) => Promise<Uint8Array>
  readDimensions: (blob: Blob) => Promise<{ width: number; height: number }>
  createObjectURL: (blob: Blob) => string
  revokeObjectURL: (url: string) => void
  onChange: (image: LoadedImage | null) => void
}

export interface ImageLoader {
  load(file: Blob, name: string): Promise<void>
  clear(): void
  dispose(): void
}

/**
 * Pure generation-guarded image loader behind `useLoadedImage`, extracted so it
 * can be tested without a DOM. Every `load`, `clear`, and `dispose` bumps the
 * generation counter; superseded or post-unmount loads return quietly without
 * throwing stale format errors or allocating orphaned object URLs.
 */
export function createImageLoader(deps: ImageLoaderDeps): ImageLoader {
  let generation = 0
  let currentUrl: string | null = null

  const swap = (next: LoadedImage | null) => {
    if (currentUrl) deps.revokeObjectURL(currentUrl)
    currentUrl = next?.url ?? null
    deps.onChange(next)
  }

  return {
    async load(file: Blob, name: string): Promise<void> {
      const gen = ++generation
      let head: Uint8Array
      try {
        head = await deps.readHead(file)
      } catch (err) {
        if (gen !== generation) return
        throw err
      }
      if (gen !== generation) return
      const format = sniffFormat(head)
      if (!format) throw new Error(UNSUPPORTED_FORMAT)
      const { width, height } = await deps.readDimensions(file)
      if (gen !== generation) return // a newer load, clear, or unmount won
      swap({
        blob: file,
        name,
        url: deps.createObjectURL(file),
        width,
        height,
        format,
        size: file.size,
      })
    },
    clear() {
      generation++
      swap(null)
    },
    dispose() {
      generation++
      if (currentUrl) {
        deps.revokeObjectURL(currentUrl)
        currentUrl = null
      }
    },
  }
}

/**
 * Holds the photo the user picked. The format comes from the file's magic
 * bytes (pasted and dropped files often have no or a wrong MIME type).
 */
export function useLoadedImage() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [loader] = useState(() =>
    createImageLoader({
      readHead: async (blob) => new Uint8Array(await blob.slice(0, 16).arrayBuffer()),
      readDimensions: dimensions,
      createObjectURL: (blob) => URL.createObjectURL(blob),
      revokeObjectURL: (url) => URL.revokeObjectURL(url),
      onChange: setImage,
    }),
  )

  useEffect(() => () => loader.dispose(), [loader])

  return { image, load: loader.load, clear: loader.clear }
}
