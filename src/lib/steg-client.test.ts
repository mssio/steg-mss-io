import { describe, expect, test } from 'bun:test'
import type { StegWorkerRequest, StegWorkerResponse } from './steg-types'
import { createStegClient, type WorkerLike } from './steg-client'

class FakeWorker implements WorkerLike {
  posted: Array<{ message: StegWorkerRequest; transfer: Transferable[] }> = []
  terminated = false
  private listeners: {
    message: Array<(event: MessageEvent<StegWorkerResponse>) => void>
    error: Array<(event: Event) => void>
    messageerror: Array<(event: Event) => void>
  } = { message: [], error: [], messageerror: [] }

  postMessage(message: StegWorkerRequest, transfer: Transferable[]): void {
    this.posted.push({ message, transfer })
  }

  addEventListener(type: 'message', listener: (event: MessageEvent<StegWorkerResponse>) => void): void
  addEventListener(type: 'error', listener: (event: Event) => void): void
  addEventListener(type: 'messageerror', listener: (event: Event) => void): void
  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener: ((event: MessageEvent<StegWorkerResponse>) => void) | ((event: Event) => void),
  ): void {
    if (type === 'message') {
      this.listeners.message.push(listener as (event: MessageEvent<StegWorkerResponse>) => void)
    } else if (type === 'error') {
      this.listeners.error.push(listener as (event: Event) => void)
    } else {
      this.listeners.messageerror.push(listener as (event: Event) => void)
    }
  }

  terminate(): void {
    this.terminated = true
  }

  emitMessage(data: StegWorkerResponse): void {
    const event = { data } as MessageEvent<StegWorkerResponse>
    for (const fn of this.listeners.message) fn(event)
  }

  emitError(): void {
    const event = { preventDefault() {} } as Event
    for (const fn of this.listeners.error) fn(event)
  }

  emitMessageError(): void {
    const event = {} as Event
    for (const fn of this.listeners.messageerror) fn(event)
  }
}

describe('createStegClient', () => {
  test('lazily spawns the worker on first call and reuses it', async () => {
    const workers: FakeWorker[] = []
    const client = createStegClient(() => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    })

    expect(workers).toHaveLength(0)

    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' })
    const p1 = client.capacity(blob)
    await Bun.sleep(0)
    expect(workers).toHaveLength(1)
    expect(workers[0].posted).toHaveLength(1)

    const req1 = workers[0].posted[0]
    expect(req1.message.op).toBe('capacity')
    expect(req1.transfer).toHaveLength(1)
    workers[0].emitMessage({ id: req1.message.id, ok: true, result: 420 })
    expect(await p1).toBe(420)

    const p2 = client.reveal(blob, 'pw')
    await Bun.sleep(0)
    expect(workers).toHaveLength(1)
    const req2 = workers[0].posted[1]
    expect(req2.message.op).toBe('reveal')
    // Fresh buffer per call — never reuses the previous ArrayBuffer
    expect(req2.transfer[0]).not.toBe(req1.transfer[0])
    workers[0].emitMessage({ id: req2.message.id, ok: true, result: 'hello' })
    expect(await p2).toBe('hello')
  })

  test('transfers hide and diff buffers and wraps returned bytes in Blobs', async () => {
    const w = new FakeWorker()
    const client = createStegClient(() => w)
    const orig = new Blob([new Uint8Array([10, 20])], { type: 'image/jpeg' })

    const hidePromise = client.hide(orig, 'secret', 'pass')
    await Bun.sleep(0)
    const hideReq = w.posted[0]
    expect(hideReq.message.op).toBe('hide')
    expect(hideReq.transfer).toHaveLength(1)

    const outBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer
    w.emitMessage({
      id: hideReq.message.id,
      ok: true,
      result: { bytes: outBytes, mime: 'image/jpeg', blocksUsed: 800, blocksTotal: 5000 },
    })
    const out = await hidePromise
    expect(out.mime).toBe('image/jpeg')
    expect(out.blocksUsed).toBe(800)
    expect(out.blocksTotal).toBe(5000)
    expect(out.blob.type).toBe('image/jpeg')
    expect(new Uint8Array(await out.blob.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))

    const diffPromise = client.diffPreview(orig, out.blob)
    await Bun.sleep(0)
    const diffReq = w.posted[1]
    expect(diffReq.message.op).toBe('diff')
    expect(diffReq.transfer).toHaveLength(2)
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer
    w.emitMessage({ id: diffReq.message.id, ok: true, result: pngBytes })
    const diffBlob = await diffPromise
    expect(diffBlob.type).toBe('image/png')
    expect(new Uint8Array(await diffBlob.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
  })

  test('non-fatal ok:false rejects with worker error and does not respawn the worker', async () => {
    const workers: FakeWorker[] = []
    const client = createStegClient(() => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    })
    const blob = new Blob([new Uint8Array([1, 2])])

    const p1 = client.reveal(blob, 'wrong')
    await Bun.sleep(0)
    expect(workers).toHaveLength(1)
    workers[0].emitMessage({
      id: workers[0].posted[0].message.id,
      ok: false,
      error: 'No message found, or the password is wrong.',
    })

    await expect(p1).rejects.toThrow('No message found, or the password is wrong.')
    expect(workers[0].terminated).toBe(false)

    const p2 = client.capacity(blob)
    await Bun.sleep(0)
    expect(workers).toHaveLength(1)
    expect(workers[0].posted).toHaveLength(2)
    workers[0].emitMessage({
      id: workers[0].posted[1].message.id,
      ok: true,
      result: 320,
    })
    expect(await p2).toBe(320)
  })

  test('fatal:true response rejects with fallback, fails other in-flight calls, and respawns on next call', async () => {
    const workers: FakeWorker[] = []
    const client = createStegClient(() => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    })
    const blob = new Blob([new Uint8Array([1, 2])])

    const pHide = client.hide(blob, 'msg', 'pw')
    const pReveal = client.reveal(blob, 'pw')
    for (let i = 0; i < 20 && (workers[0]?.posted.length ?? 0) < 2; i++) {
      await Bun.sleep(1)
    }
    expect(workers).toHaveLength(1)
    expect(workers[0].posted).toHaveLength(2)

    const hideErr = pHide.then(
      () => null,
      (err: unknown) => err,
    )
    const revealErr = pReveal.then(
      () => null,
      (err: unknown) => err,
    )

    workers[0].emitMessage({
      id: workers[0].posted[0].message.id,
      ok: false,
      error: 'Something went wrong. Please try again.',
      fatal: true,
    })

    expect(await hideErr).toEqual(new Error('Something went wrong. Please try again.'))
    expect(await revealErr).toEqual(new Error('No message found, or the password is wrong.'))
    expect(workers[0].terminated).toBe(true)

    const pNext = client.capacity(blob)
    for (let i = 0; i < 20 && (workers[1]?.posted.length ?? 0) < 1; i++) {
      await Bun.sleep(1)
    }
    expect(workers).toHaveLength(2)
    expect(workers[1].terminated).toBe(false)
    workers[1].emitMessage({
      id: workers[1].posted[0].message.id,
      ok: true,
      result: 500,
    })
    expect(await pNext).toBe(500)
  })

  test('maps unexpected worker errors to op-specific fallbacks and respawns on next call', async () => {
    const workers: FakeWorker[] = []
    const client = createStegClient(() => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    })
    const blob = new Blob([new Uint8Array([1, 2])])

    const pReveal = client.reveal(blob, 'pw')
    const pHide = client.hide(blob, 'msg', 'pw')
    for (let i = 0; i < 20 && (workers[0]?.posted.length ?? 0) < 2; i++) {
      await Bun.sleep(1)
    }
    expect(workers).toHaveLength(1)
    expect(workers[0].posted).toHaveLength(2)

    const revealErr = pReveal.then(
      () => null,
      (err: unknown) => err,
    )
    const hideErr = pHide.then(
      () => null,
      (err: unknown) => err,
    )

    workers[0].emitError()

    expect(await revealErr).toEqual(new Error('No message found, or the password is wrong.'))
    expect(await hideErr).toEqual(new Error('Something went wrong. Please try again.'))
    expect(workers[0].terminated).toBe(true)

    const pCap = client.capacity(blob)
    for (let i = 0; i < 20 && (workers[1]?.posted.length ?? 0) < 1; i++) {
      await Bun.sleep(1)
    }
    expect(workers).toHaveLength(2)
    workers[1].emitMessage({ id: workers[1].posted[0].message.id, ok: true, result: 123 })
    expect(await pCap).toBe(123)
  })

  test('warm spawns the worker once and subsequent calls reuse it', async () => {
    const workers: FakeWorker[] = []
    const client = createStegClient(() => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    })

    expect(workers).toHaveLength(0)

    const pWarm = client.warm()
    expect(workers).toHaveLength(1)
    expect(workers[0].posted).toHaveLength(1)
    const warmReq = workers[0].posted[0]
    expect(warmReq.message.op).toBe('warm')
    expect(warmReq.transfer).toHaveLength(0)
    workers[0].emitMessage({ id: warmReq.message.id, ok: true, result: null })
    expect(await pWarm).toBeUndefined()

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    const pDetail = client.capacityDetail(blob)
    await Bun.sleep(0)
    expect(workers).toHaveLength(1)
    expect(workers[0].posted).toHaveLength(2)
    const detailReq = workers[0].posted[1]
    expect(detailReq.message.op).toBe('capacityDetail')
    expect(detailReq.transfer).toHaveLength(1)
    workers[0].emitMessage({
      id: detailReq.message.id,
      ok: true,
      result: { chars: 500, bytes: 1117 },
    })
    expect(await pDetail).toEqual({ chars: 500, bytes: 1117 })
  })

  test('rejects lone UTF-16 surrogates in password or message before spawning the worker', async () => {
    const workers: FakeWorker[] = []
    const client = createStegClient(() => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    })
    const blob = new Blob([new Uint8Array([1, 2, 3])])

    await expect(client.hide(blob, 'hello', 'a\uD800')).rejects.toThrow(
      'The password contains a broken character. Please retype it.',
    )
    await expect(client.hide(blob, 'hello\uDC00', 'valid-pass')).rejects.toThrow(
      'The message contains a broken character. Please retype it.',
    )
    await expect(client.reveal(blob, 'a\uDBFF')).rejects.toThrow(
      'The password contains a broken character. Please retype it.',
    )
    expect(workers).toHaveLength(0)
  })
})
