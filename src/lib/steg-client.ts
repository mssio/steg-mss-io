import { isWellFormedUtf16 } from './format'
import {
  GENERIC_FALLBACK,
  type CapacityDetail,
  type HideOutput,
  type StegWorkerRequest,
  type StegWorkerResponse,
  type StegWorkerResult,
  type WorkerHideResult,
} from './steg-types'

const REVEAL_FALLBACK = 'No message found, or the password is wrong.'
const BROKEN_PASSWORD = 'The password contains a broken character. Please retype it.'
const BROKEN_MESSAGE = 'The message contains a broken character. Please retype it.'

type Op = StegWorkerRequest['op']

function fallbackError(op: Op): string {
  return op === 'reveal' ? REVEAL_FALLBACK : GENERIC_FALLBACK
}

export interface WorkerLike {
  postMessage(message: StegWorkerRequest, transfer: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent<StegWorkerResponse>) => void): void
  addEventListener(type: 'error', listener: (event: Event) => void): void
  addEventListener(type: 'messageerror', listener: (event: Event) => void): void
  terminate(): void
}

interface PendingCall {
  op: Op
  resolve: (value: StegWorkerResult) => void
  reject: (reason: Error) => void
}

export interface StegClient {
  hide(image: Blob, message: string, password: string): Promise<HideOutput>
  reveal(image: Blob, password: string): Promise<string>
  capacity(image: Blob): Promise<number>
  capacityDetail(image: Blob): Promise<CapacityDetail>
  diffPreview(original: Blob, stego: Blob): Promise<Blob>
  warm(): Promise<void>
}

export function createStegClient(spawn: () => WorkerLike): StegClient {
  let worker: WorkerLike | null = null
  let nextId = 1
  const pending = new Map<number, PendingCall>()

  function failAllAndReset() {
    const active = worker
    worker = null
    if (active) {
      try {
        active.terminate()
      } catch {
        // Ignore cleanup errors on an already-dead worker.
      }
    }
    const entries = [...pending.values()]
    pending.clear()
    for (const entry of entries) {
      entry.reject(new Error(fallbackError(entry.op)))
    }
  }

  function getWorker(): WorkerLike {
    if (worker) return worker
    const created = spawn()
    created.addEventListener('message', (event) => {
      if (worker !== created) return
      const res = event.data
      if (!res || typeof res.id !== 'number') return
      const entry = pending.get(res.id)
      if (entry) {
        pending.delete(res.id)
        if (res.ok) {
          entry.resolve(res.result)
        } else {
          const message = res.fatal
            ? fallbackError(entry.op)
            : res.error || fallbackError(entry.op)
          entry.reject(new Error(message))
        }
      }
      if (!res.ok && res.fatal) {
        failAllAndReset()
      }
    })
    created.addEventListener('error', (event) => {
      event.preventDefault?.()
      if (worker !== created) return
      failAllAndReset()
    })
    created.addEventListener('messageerror', () => {
      if (worker !== created) return
      failAllAndReset()
    })
    worker = created
    return created
  }

  function request(req: StegWorkerRequest, transfer: Transferable[]): Promise<StegWorkerResult> {
    return new Promise((resolve, reject) => {
      pending.set(req.id, { op: req.op, resolve, reject })
      try {
        getWorker().postMessage(req, transfer)
      } catch {
        pending.delete(req.id)
        reject(new Error(fallbackError(req.op)))
      }
    })
  }

  async function readBuffer(blob: Blob, op: Op): Promise<ArrayBuffer> {
    try {
      return await blob.arrayBuffer()
    } catch {
      throw new Error(fallbackError(op))
    }
  }

  return {
    async hide(image: Blob, message: string, password: string): Promise<HideOutput> {
      if (!isWellFormedUtf16(password)) throw new Error(BROKEN_PASSWORD)
      if (!isWellFormedUtf16(message)) throw new Error(BROKEN_MESSAGE)
      const buffer = await readBuffer(image, 'hide')
      const res = (await request(
        { id: nextId++, op: 'hide', image: buffer, message, password },
        [buffer],
      )) as WorkerHideResult
      return {
        blob: new Blob([res.bytes], { type: res.mime }),
        mime: res.mime,
        blocksUsed: res.blocksUsed,
        blocksTotal: res.blocksTotal,
      }
    },

    async reveal(image: Blob, password: string): Promise<string> {
      if (!isWellFormedUtf16(password)) throw new Error(BROKEN_PASSWORD)
      const buffer = await readBuffer(image, 'reveal')
      return (await request(
        { id: nextId++, op: 'reveal', image: buffer, password },
        [buffer],
      )) as string
    },

    async capacity(image: Blob): Promise<number> {
      const buffer = await readBuffer(image, 'capacity')
      return (await request({ id: nextId++, op: 'capacity', image: buffer }, [buffer])) as number
    },

    async capacityDetail(image: Blob): Promise<CapacityDetail> {
      const buffer = await readBuffer(image, 'capacityDetail')
      return (await request({ id: nextId++, op: 'capacityDetail', image: buffer }, [
        buffer,
      ])) as CapacityDetail
    },

    async diffPreview(original: Blob, stego: Blob): Promise<Blob> {
      const [originalBuf, stegoBuf] = await Promise.all([
        readBuffer(original, 'diff'),
        readBuffer(stego, 'diff'),
      ])
      const png = (await request(
        { id: nextId++, op: 'diff', original: originalBuf, stego: stegoBuf },
        [originalBuf, stegoBuf],
      )) as ArrayBuffer
      return new Blob([png], { type: 'image/png' })
    },

    async warm(): Promise<void> {
      await request({ id: nextId++, op: 'warm' }, [])
    },
  }
}

const defaultClient = createStegClient(
  () => new Worker(new URL('../workers/steg.worker.ts', import.meta.url), { type: 'module' }),
)

export function hide(image: Blob, message: string, password: string): Promise<HideOutput> {
  return defaultClient.hide(image, message, password)
}

export function reveal(image: Blob, password: string): Promise<string> {
  return defaultClient.reveal(image, password)
}

export function capacity(image: Blob): Promise<number> {
  return defaultClient.capacity(image)
}

export function capacityDetail(image: Blob): Promise<CapacityDetail> {
  return defaultClient.capacityDetail(image)
}

export function diffPreview(original: Blob, stego: Blob): Promise<Blob> {
  return defaultClient.diffPreview(original, stego)
}

export function warm(): Promise<void> {
  return defaultClient.warm()
}
