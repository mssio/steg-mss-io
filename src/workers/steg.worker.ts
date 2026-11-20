import init, { capacity, capacity_detail, diff_preview, hide, reveal } from '../wasm/steg_core.js'
import wasmUrl from '../wasm/steg_core_bg.wasm?url'
import type { StegWorkerRequest, StegWorkerResponse } from '../lib/steg-types'

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<StegWorkerRequest>) => void): void
  postMessage(message: StegWorkerResponse, transfer?: Transferable[]): void
}

const scope = self as unknown as WorkerScope

const REVEAL_FALLBACK = 'No message found, or the password is wrong.'
const GENERIC_FALLBACK = 'Something went wrong. Please try again.'

function fallbackError(op: StegWorkerRequest['op']): string {
  return op === 'reveal' ? REVEAL_FALLBACK : GENERIC_FALLBACK
}

let ready: Promise<unknown> | null = null
let poisoned = false

function ensureReady(): Promise<unknown> {
  if (!ready) {
    ready = init({ module_or_path: wasmUrl }).catch((err: unknown) => {
      ready = null
      throw err
    })
  }
  return ready
}

function toTransferableBuffer(view: Uint8Array): ArrayBuffer {
  if (
    view.buffer instanceof ArrayBuffer &&
    view.byteOffset === 0 &&
    view.byteLength === view.buffer.byteLength
  ) {
    return view.buffer
  }
  return view.slice().buffer
}

scope.addEventListener('message', async (event) => {
  const req = event.data
  if (poisoned) {
    scope.postMessage({ id: req.id, ok: false, error: fallbackError(req.op), fatal: true })
    return
  }
  try {
    await ensureReady()
  } catch {
    scope.postMessage({ id: req.id, ok: false, error: fallbackError(req.op) })
    return
  }

  try {
    switch (req.op) {
      case 'hide': {
        const out = hide(new Uint8Array(req.image), req.message, req.password)
        let bytes: Uint8Array
        let mime: string
        let blocksUsed: number
        let blocksTotal: number
        try {
          bytes = out.bytes
          mime = out.mime
          blocksUsed = out.blocks_used
          blocksTotal = out.blocks_total
        } finally {
          out.free()
        }
        const buffer = toTransferableBuffer(bytes)
        scope.postMessage(
          { id: req.id, ok: true, result: { bytes: buffer, mime, blocksUsed, blocksTotal } },
          [buffer],
        )
        return
      }
      case 'reveal': {
        const text = reveal(new Uint8Array(req.image), req.password)
        scope.postMessage({ id: req.id, ok: true, result: text })
        return
      }
      case 'capacity': {
        const max = capacity(new Uint8Array(req.image))
        scope.postMessage({ id: req.id, ok: true, result: max })
        return
      }
      case 'capacityDetail': {
        const out = capacity_detail(new Uint8Array(req.image))
        let chars: number
        let bytes: number
        try {
          chars = out.chars
          bytes = out.bytes
        } finally {
          out.free()
        }
        scope.postMessage({ id: req.id, ok: true, result: { chars, bytes } })
        return
      }
      case 'diff': {
        const png = diff_preview(new Uint8Array(req.original), new Uint8Array(req.stego))
        const buffer = toTransferableBuffer(png)
        scope.postMessage({ id: req.id, ok: true, result: buffer }, [buffer])
        return
      }
      case 'warm': {
        scope.postMessage({ id: req.id, ok: true, result: null })
        return
      }
    }
  } catch (err: unknown) {
    const isPlainError = err instanceof Error && err.constructor === Error
    if (isPlainError) {
      scope.postMessage({
        id: req.id,
        ok: false,
        error: err.message || fallbackError(req.op),
      })
      return
    }
    poisoned = true
    scope.postMessage({
      id: req.id,
      ok: false,
      error: fallbackError(req.op),
      fatal: true,
    })
  }
})
