import { useEffect, useRef, useState } from 'react'
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

/**
 * Holds the photo the user picked. The format comes from the file's magic
 * bytes (pasted and dropped files often have no or a wrong MIME type).
 */
export function useLoadedImage() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const urlRef = useRef<string | null>(null)
  const generation = useRef(0)

  const swap = (next: LoadedImage | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = next?.url ?? null
    setImage(next)
  }

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    },
    [],
  )

  async function load(file: Blob, name: string): Promise<void> {
    const gen = ++generation.current
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    const format = sniffFormat(head)
    if (!format) throw new Error(UNSUPPORTED_FORMAT)
    const { width, height } = await dimensions(file)
    if (gen !== generation.current) return // a newer load or clear won
    swap({ blob: file, name, url: URL.createObjectURL(file), width, height, format, size: file.size })
  }

  function clear() {
    generation.current++
    swap(null)
  }

  return { image, load, clear }
}
