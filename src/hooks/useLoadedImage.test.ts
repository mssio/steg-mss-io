import { describe, expect, test } from 'bun:test'
import { createImageLoader, UNSUPPORTED_FORMAT, type LoadedImage } from './useLoadedImage'

const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_HEAD = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const GIF_HEAD = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeHarness(overrides?: {
  readHead?: (blob: Blob) => Promise<Uint8Array>
  readDimensions?: (blob: Blob) => Promise<{ width: number; height: number }>
}) {
  const states: Array<LoadedImage | null> = []
  const created: string[] = []
  const revoked: string[] = []
  let urlSeq = 0

  const loader = createImageLoader({
    readHead:
      overrides?.readHead ?? (async (blob) => new Uint8Array(await blob.slice(0, 16).arrayBuffer())),
    readDimensions: overrides?.readDimensions ?? (async () => ({ width: 800, height: 600 })),
    createObjectURL: () => {
      const url = `blob:test/${++urlSeq}`
      created.push(url)
      return url
    },
    revokeObjectURL: (url) => {
      revoked.push(url)
    },
    onChange: (next) => states.push(next),
  })

  return { loader, states, created, revoked, last: () => states.at(-1) ?? null }
}

describe('createImageLoader', () => {
  test('loads valid PNG and revokes previous URL when replaced or cleared', async () => {
    const h = makeHarness()
    const png = new Blob([PNG_HEAD])
    const jpg = new Blob([JPEG_HEAD])

    await h.loader.load(png, 'a.png')
    expect(h.last()).toMatchObject({
      name: 'a.png',
      format: 'PNG',
      width: 800,
      height: 600,
      url: 'blob:test/1',
    })
    expect(h.created).toEqual(['blob:test/1'])
    expect(h.revoked).toEqual([])

    await h.loader.load(jpg, 'b.jpg')
    expect(h.last()).toMatchObject({ name: 'b.jpg', format: 'JPEG', url: 'blob:test/2' })
    expect(h.revoked).toEqual(['blob:test/1'])

    h.loader.clear()
    expect(h.last()).toBeNull()
    expect(h.revoked).toEqual(['blob:test/1', 'blob:test/2'])
  })

  test('rejects an active unsupported-format load', async () => {
    const h = makeHarness()
    await expect(h.loader.load(new Blob([GIF_HEAD]), 'bad.gif')).rejects.toThrow(UNSUPPORTED_FORMAT)
    expect(h.created).toEqual([])
    expect(h.states).toEqual([])
  })

  test('superseded unsupported-format load returns quietly without throwing', async () => {
    const head1 = deferred<Uint8Array>()
    const head2 = deferred<Uint8Array>()
    const heads = [head1, head2]
    let i = 0
    const h = makeHarness({ readHead: () => heads[i++]!.promise })

    const p1 = h.loader.load(new Blob([GIF_HEAD]), 'slow-bad.gif')
    const p2 = h.loader.load(new Blob([PNG_HEAD]), 'fast-good.png')

    head2.resolve(PNG_HEAD)
    await p2
    expect(h.last()).toMatchObject({ name: 'fast-good.png', format: 'PNG', url: 'blob:test/1' })

    // First load now resolves with unsupported magic bytes — must resolve quietly.
    head1.resolve(GIF_HEAD)
    await expect(p1).resolves.toBeUndefined()
    expect(h.last()).toMatchObject({ name: 'fast-good.png', format: 'PNG', url: 'blob:test/1' })
    expect(h.created).toEqual(['blob:test/1'])
  })

  test('clear() supersedes an in-flight unsupported-format load quietly', async () => {
    const head = deferred<Uint8Array>()
    const h = makeHarness({ readHead: () => head.promise })

    const p = h.loader.load(new Blob([GIF_HEAD]), 'slow-bad.gif')
    h.loader.clear()
    head.resolve(GIF_HEAD)

    await expect(p).resolves.toBeUndefined()
    expect(h.created).toEqual([])
  })

  test('dispose() during unmount prevents orphaned createObjectURL for in-flight load', async () => {
    const dims = deferred<{ width: number; height: number }>()
    const h = makeHarness({ readDimensions: () => dims.promise })

    const p = h.loader.load(new Blob([PNG_HEAD]), 'photo.png')
    // Unmount happens before dimensions() resolves.
    h.loader.dispose()
    dims.resolve({ width: 1600, height: 1200 })

    await expect(p).resolves.toBeUndefined()
    expect(h.created).toEqual([])
    expect(h.states).toEqual([])
  })

  test('dispose() while reading header suppresses stale format error and object URL', async () => {
    const head = deferred<Uint8Array>()
    const h = makeHarness({ readHead: () => head.promise })

    const p = h.loader.load(new Blob([GIF_HEAD]), 'bad.gif')
    h.loader.dispose()
    head.resolve(GIF_HEAD)

    await expect(p).resolves.toBeUndefined()
    expect(h.created).toEqual([])
    expect(h.states).toEqual([])
  })

  test('dispose() revokes any currently loaded object URL without emitting state', async () => {
    const h = makeHarness()
    await h.loader.load(new Blob([PNG_HEAD]), 'photo.png')
    expect(h.states.length).toBe(1)

    h.loader.dispose()
    expect(h.revoked).toEqual(['blob:test/1'])
    expect(h.states.length).toBe(1)
  })

  test('loadFrom() resolving after a direct load() does not replace it', async () => {
    const sample = deferred<{ blob: Blob; name: string }>()
    const h = makeHarness()

    const pSample = h.loader.loadFrom(() => sample.promise)
    await h.loader.load(new Blob([PNG_HEAD]), 'dropped.png')
    expect(h.last()).toMatchObject({ name: 'dropped.png', format: 'PNG', url: 'blob:test/1' })

    sample.resolve({ blob: new Blob([JPEG_HEAD]), name: 'landscape.jpg' })
    await expect(pSample).resolves.toBeUndefined()

    expect(h.last()).toMatchObject({ name: 'dropped.png', format: 'PNG', url: 'blob:test/1' })
    expect(h.created).toEqual(['blob:test/1'])
    expect(h.revoked).toEqual([])
  })

  test('two loadFrom() calls resolving out of order let the later-started one win', async () => {
    const first = deferred<{ blob: Blob; name: string }>()
    const second = deferred<{ blob: Blob; name: string }>()
    const h = makeHarness()

    const p1 = h.loader.loadFrom(() => first.promise)
    const p2 = h.loader.loadFrom(() => second.promise)

    second.resolve({ blob: new Blob([PNG_HEAD]), name: 'still-life.jpg' })
    await p2
    expect(h.last()).toMatchObject({ name: 'still-life.jpg', format: 'PNG', url: 'blob:test/1' })

    first.resolve({ blob: new Blob([JPEG_HEAD]), name: 'landscape.jpg' })
    await expect(p1).resolves.toBeUndefined()

    expect(h.last()).toMatchObject({ name: 'still-life.jpg', format: 'PNG', url: 'blob:test/1' })
    expect(h.created).toEqual(['blob:test/1'])
  })

  test('superseded loadFrom() source rejection is swallowed while active rejection throws', async () => {
    const first = deferred<{ blob: Blob; name: string }>()
    const h = makeHarness()

    const p1 = h.loader.loadFrom(() => first.promise)
    await h.loader.load(new Blob([PNG_HEAD]), 'newer.png')

    first.reject(new Error('network error'))
    await expect(p1).resolves.toBeUndefined()
    expect(h.last()).toMatchObject({ name: 'newer.png', format: 'PNG', url: 'blob:test/1' })

    await expect(
      h.loader.loadFrom(async () => {
        throw new Error('active failure')
      }),
    ).rejects.toThrow('active failure')
  })
})
