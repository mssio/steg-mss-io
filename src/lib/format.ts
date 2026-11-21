/** Small, pure formatting helpers shared by the studio UI. */

export type ImageFormat = 'PNG' | 'JPEG'
export type MeterState = 'ok' | 'near' | 'over'

/** Characters as the core counts them: Unicode code points. */
export function codePoints(s: string): number {
  return [...s].length
}

const encoder = new TextEncoder()

/** Length of the string once encoded as UTF-8. */
export function utf8Bytes(s: string): number {
  return encoder.encode(s).length
}

const UNITS = ['B', 'KB', 'MB', 'GB'] as const

/** Decimal units, one decimal below 10: `512 B`, `880 KB`, `1.4 MB`. */
export function formatBytes(n: number): string {
  let value = n
  let unit = 0
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000
    unit++
  }
  if (unit === 0) return `${Math.round(value)} B`
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value)
  return `${rounded} ${UNITS[unit]}`
}

/** `IMG_01.jpeg` + `image/jpeg` → `IMG_01-steg.jpg`; no name → `image-steg.<ext>`. */
export function stegFileName(original: string, mime: string): string {
  const ext = mime === 'image/png' ? 'png' : 'jpg'
  const dot = original.lastIndexOf('.')
  const base = (dot > 0 ? original.slice(0, dot) : dot === 0 ? '' : original).trim()
  return `${base || 'image'}-steg.${ext}`
}

/** `near` from 90% of the max, `over` past it. */
export function meterState(used: number, max: number): MeterState {
  if (used > max) return 'over'
  if (max > 0 && used >= max * 0.9) return 'near'
  return 'ok'
}

export interface CapacityLimits {
  chars: number
  bytes: number
}

export interface CapacityAssessment {
  chars: number
  bytes: number
  showBytes: boolean
  charState: MeterState
  byteState: MeterState
  /** Whichever ratio (`chars / max.chars` or `bytes / max.bytes`) is higher. */
  state: MeterState
  /** Higher ratio as a 0..100 percentage. */
  pct: number
  /** True when `[...text].length > detail.chars || utf8Bytes(text) > detail.bytes`. */
  over: boolean
}

const STATE_RANK: Record<MeterState, number> = { ok: 0, near: 1, over: 2 }

/** Evaluates a message against both the character and UTF-8 byte limits. */
export function capacityState(text: string, detail: CapacityLimits): CapacityAssessment {
  const chars = codePoints(text)
  const bytes = utf8Bytes(text)
  const charState = meterState(chars, detail.chars)
  const byteState = meterState(bytes, detail.bytes)
  const state = STATE_RANK[byteState] > STATE_RANK[charState] ? byteState : charState
  const charRatio = detail.chars > 0 ? chars / detail.chars : chars > 0 ? 1 : 0
  const byteRatio = detail.bytes > 0 ? bytes / detail.bytes : bytes > 0 ? 1 : 0
  const pct = Math.min(100, Math.max(charRatio, byteRatio) * 100)
  return {
    chars,
    bytes,
    showBytes: bytes > chars,
    charState,
    byteState,
    state,
    pct,
    over: chars > detail.chars || bytes > detail.bytes,
  }
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

/** True when `s` contains no unpaired UTF-16 surrogates (so UTF-8 conversion is lossless). */
export function isWellFormedUtf16(s: string): boolean {
  const native = (s as string & { isWellFormed?: () => boolean }).isWellFormed
  if (typeof native === 'function') return native.call(s)
  return !LONE_SURROGATE.test(s)
}

/** The image format from its magic bytes, or null if it is neither PNG nor JPEG. */
export function sniffFormat(head: Uint8Array): ImageFormat | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (head.length >= png.length && png.every((b, i) => head[i] === b)) return 'PNG'
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'JPEG'
  return null
}
