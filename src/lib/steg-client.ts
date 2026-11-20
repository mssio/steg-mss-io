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
  return 'Meet me at the old lighthouse at six.'
}

export async function capacity(_image: Blob): Promise<number> {
  await wait(STUB_DELAY_MS)
  return 412
}

export async function diffPreview(original: Blob, _stego: Blob): Promise<Blob> {
  await wait(STUB_DELAY_MS)
  return original
}
