import { describe, expect, test } from 'bun:test'
import {
  codePoints,
  formatBytes,
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
