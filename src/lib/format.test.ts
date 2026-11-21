import { describe, expect, test } from 'bun:test'
import {
  capacityState,
  codePoints,
  formatBytes,
  isWellFormedUtf16,
  meterState,
  sniffFormat,
  stegFileName,
  utf8Bytes,
} from './format'

describe('codePoints / utf8Bytes', () => {
  test('count code points, not UTF-16 units', () => {
    expect(codePoints('👀a')).toBe(2)
    expect(codePoints('')).toBe(0)
  })
  test('count UTF-8 bytes', () => {
    expect(utf8Bytes('👀a')).toBe(5)
    expect(utf8Bytes('é')).toBe(2)
    expect(utf8Bytes('abc')).toBe(3)
  })
})

describe('formatBytes', () => {
  test('uses decimal units with one decimal below 10', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(879_601)).toBe('880 KB')
    expect(formatBytes(1_400_000)).toBe('1.4 MB')
    expect(formatBytes(12_345_678)).toBe('12 MB')
  })
})

describe('stegFileName', () => {
  test('replaces the extension to match the output format', () => {
    expect(stegFileName('IMG_01.jpeg', 'image/jpeg')).toBe('IMG_01-steg.jpg')
    expect(stegFileName('IMG_01.jpeg', 'image/png')).toBe('IMG_01-steg.png')
    expect(stegFileName('scan.PNG', 'image/png')).toBe('scan-steg.png')
    expect(stegFileName('my.holiday.photo.jpg', 'image/jpeg')).toBe(
      'my.holiday.photo-steg.jpg',
    )
  })
  test('falls back to "image" without a usable name', () => {
    expect(stegFileName('', 'image/jpeg')).toBe('image-steg.jpg')
    expect(stegFileName('', 'image/png')).toBe('image-steg.png')
    expect(stegFileName('.jpg', 'image/jpeg')).toBe('image-steg.jpg')
  })
})

describe('meterState', () => {
  test('ok below 90%, near from 90%, over past the max', () => {
    expect(meterState(10, 412)).toBe('ok')
    expect(meterState(371, 412)).toBe('near')
    expect(meterState(412, 412)).toBe('near')
    expect(meterState(413, 412)).toBe('over')
  })
})

describe('capacityState', () => {
  const sampleDetail = { chars: 500, bytes: 1117 }

  test('ASCII text uses char ratio and hides byte readout', () => {
    const ok = capacityState('a'.repeat(100), sampleDetail)
    expect(ok).toMatchObject({
      chars: 100,
      bytes: 100,
      showBytes: false,
      charState: 'ok',
      byteState: 'ok',
      state: 'ok',
      over: false,
    })
    expect(ok.pct).toBeCloseTo(20)

    const near = capacityState('a'.repeat(450), sampleDetail)
    expect(near).toMatchObject({ charState: 'near', byteState: 'ok', state: 'near', over: false })
    expect(near.pct).toBeCloseTo(90)

    const over = capacityState('a'.repeat(501), sampleDetail)
    expect(over).toMatchObject({ charState: 'over', byteState: 'ok', state: 'over', over: true, pct: 100 })
  })

  test('multi-byte text within char cap but over byte cap is over and disables Hide', () => {
    // 450 CJK chars = 450 code points (<= 500), 1350 UTF-8 bytes (> 1117).
    const res = capacityState('漢'.repeat(450), sampleDetail)
    expect(res).toMatchObject({
      chars: 450,
      bytes: 1350,
      showBytes: true,
      charState: 'near',
      byteState: 'over',
      state: 'over',
      over: true,
      pct: 100,
    })
  })

  test('multi-byte text within both caps is allowed even when bytes exceed char cap', () => {
    // 300 accented chars = 300 code points (<= 500), 600 UTF-8 bytes (> 500, <= 1117).
    const res = capacityState('é'.repeat(300), sampleDetail)
    expect(res).toMatchObject({
      chars: 300,
      bytes: 600,
      showBytes: true,
      charState: 'ok',
      byteState: 'ok',
      state: 'ok',
      over: false,
    })
    expect(res.pct).toBeCloseTo(60)
  })

  test('uses whichever ratio is higher for meter state and percentage', () => {
    // 340 CJK chars = 340/500 (68%, ok) and 1020/1117 (91.3%, near) -> overall near.
    const res = capacityState('漢'.repeat(340), sampleDetail)
    expect(res).toMatchObject({
      chars: 340,
      bytes: 1020,
      showBytes: true,
      charState: 'ok',
      byteState: 'near',
      state: 'near',
      over: false,
    })
    expect(res.pct).toBeCloseTo((1020 / 1117) * 100)
  })

  test('handles small images where bytes equals chars (< 500)', () => {
    const small = { chars: 80, bytes: 80 }
    // 30 four-byte emoji = 30 chars (ok), 120 bytes (over).
    const res = capacityState('😀'.repeat(30), small)
    expect(res).toMatchObject({
      chars: 30,
      bytes: 120,
      showBytes: true,
      charState: 'ok',
      byteState: 'over',
      state: 'over',
      over: true,
      pct: 100,
    })
  })
})

describe('sniffFormat', () => {
  test('recognises PNG and JPEG by their magic bytes', () => {
    expect(sniffFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('PNG')
    expect(sniffFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('JPEG')
  })
  test('rejects anything else', () => {
    // "RIFF....WEBP"
    expect(sniffFormat(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBeNull()
    expect(sniffFormat(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull()
    expect(sniffFormat(new Uint8Array([]))).toBeNull()
  })
})

describe('isWellFormedUtf16', () => {
  const valid = ['', 'hello', 'café 漢字', '👀🔥', 'a\uD83D\uDE00b']
  const invalid = [
    '\uD800',
    '\uDBFF',
    '\uDC00',
    '\uDFFF',
    'a\uD800',
    'a\uDBFF',
    '\uDC00a',
    '\uDC00\uD800',
    'a\uD800b\uDC00',
    '\uD83D\uDE00\uD800',
  ]

  test('accepts well-formed strings and rejects lone surrogates', () => {
    for (const s of valid) expect(isWellFormedUtf16(s)).toBe(true)
    for (const s of invalid) expect(isWellFormedUtf16(s)).toBe(false)
  })

  test('regex fallback matches native behavior when String.prototype.isWellFormed is absent', () => {
    const proto = String.prototype as { isWellFormed?: () => boolean }
    const saved = Object.getOwnPropertyDescriptor(proto, 'isWellFormed')
    Object.defineProperty(proto, 'isWellFormed', { value: undefined, configurable: true, writable: true })
    try {
      for (const s of valid) expect(isWellFormedUtf16(s)).toBe(true)
      for (const s of invalid) expect(isWellFormedUtf16(s)).toBe(false)
    } finally {
      if (saved) Object.defineProperty(proto, 'isWellFormed', saved)
      else delete proto.isWellFormed
    }
  })
})
