import type { HideOutput } from './steg-types'

/*
 * STUB (Task 7). Task 9 replaces the bodies with calls into the WASM worker
 * and keeps these exact signatures. Rejections are `Error`s whose message is
 * already user-facing.
 */

const STUB_DELAY_MS = 800

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function hide(image: Blob, message: string, password: string): Promise<HideOutput> {
  await wait(STUB_DELAY_MS)
  if (!message) throw new Error('Enter a message.')
  if (!password) throw new Error('Enter a password.')
  const mime = image.type === 'image/png' ? 'image/png' : 'image/jpeg'
  return { blob: image, mime, blocksUsed: 2_478, blocksTotal: 49_152 }
}

export async function reveal(_image: Blob, password: string): Promise<string> {
  await wait(STUB_DELAY_MS)
  if (!password) throw new Error('Enter a password.')
  // Lets the error state be exercised before the real core is wired in.
  if (password === 'wrong') throw new Error('No message found, or the password is wrong.')
  return 'Meet me at the old lighthouse at six. Bring the blue notebook, and come alone.'
}

export async function capacity(_image: Blob): Promise<number> {
  await wait(STUB_DELAY_MS)
  return 412
}

/**
 * Stand-in for the core's `|original − stego| × 8` image: near-black with a
 * faint speckle on scattered 8×8 blocks, so the difference view looks like
 * the real thing in reviews.
 */
export async function diffPreview(original: Blob, _stego: Blob): Promise<Blob> {
  await wait(STUB_DELAY_MS)
  const bitmap = await createImageBitmap(original)
  const { width, height } = bitmap
  bitmap.close()
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return original
  const img = ctx.createImageData(width, height)
  const px = img.data
  let seed = 0x2545f491
  const rand = () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return (seed >>> 0) / 0x1_0000_0000
  }
  for (let i = 3; i < px.length; i += 4) px[i] = 255
  for (let by = 0; by + 8 <= height; by += 8) {
    for (let bx = 0; bx + 8 <= width; bx += 8) {
      if (rand() > 0.42) continue
      const level = 40 + rand() * 120
      for (let y = 2; y < 6; y++) {
        for (let x = 2; x < 6; x++) {
          const o = ((by + y) * width + bx + x) * 4
          const v = level * (0.6 + rand() * 0.4)
          px[o] = v
          px[o + 1] = v
          px[o + 2] = v
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? original), 'image/png'))
}
