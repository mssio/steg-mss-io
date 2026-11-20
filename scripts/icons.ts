import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const ROOT = resolve(import.meta.dir, '..')
const PUBLIC = resolve(ROOT, 'public')

const DARK_BG = '#0D0E0C'
const DARK_FG = '#ECE8DF'
const DARK_ACCENT = '#FFB547'
const LIGHT_FG = '#1A1A17'
const LIGHT_ACCENT = '#8F5400'

/**
 * Extract the inner geometry of public/logo.svg so every derived icon
 * stays locked to a single source of truth.
 */
function readLogoInner(): string {
  const raw = readFileSync(resolve(PUBLIC, 'logo.svg'), 'utf8')
  const match = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)
  if (!match) throw new Error('Could not parse public/logo.svg')
  return match[1].trim()
}

/**
 * Build public/favicon.svg from public/logo.svg with a prefers-color-scheme
 * stylesheet so the mark reads clearly on both light and dark browser tabs.
 */
function buildFaviconSvg(inner: string): string {
  const themedInner = inner
    .replaceAll(`stroke="${DARK_FG}"`, 'class="outline"')
    .replaceAll(`fill="${DARK_FG}"`, 'class="pixel"')
    .replaceAll(`fill="${DARK_ACCENT}"`, 'class="accent"')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <style>
    .outline { stroke: ${LIGHT_FG}; }
    .pixel { fill: ${LIGHT_FG}; }
    .accent { fill: ${LIGHT_ACCENT}; }
    @media (prefers-color-scheme: dark) {
      .outline { stroke: ${DARK_FG}; }
      .pixel { fill: ${DARK_FG}; }
      .accent { fill: ${DARK_ACCENT}; }
    }
  </style>
  ${themedInner}
</svg>
`
}

/**
 * Wrap the logo in an opaque darkroom tile for raster app icons and ICO fallback.
 */
function buildTiledSvg(inner: string, options: { rounded: boolean; padFraction: number }): string {
  const scale = 1 - options.padFraction * 2
  const offset = 32 * options.padFraction
  const bg = options.rounded
    ? `<rect width="32" height="32" rx="7" fill="${DARK_BG}" />`
    : `<rect width="32" height="32" fill="${DARK_BG}" />
  <rect width="32" height="32" fill="url(#safelight)" />`

  const defs = options.rounded
    ? ''
    : `<defs>
    <radialGradient id="safelight" cx="50%" cy="0%" r="80%">
      <stop offset="0%" stop-color="${DARK_ACCENT}" stop-opacity="0.14" />
      <stop offset="100%" stop-color="${DARK_BG}" stop-opacity="0" />
    </radialGradient>
  </defs>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  ${defs}
  ${bg}
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    ${inner}
  </g>
</svg>`
}

function renderPng(svg: string, size: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  })
  return Buffer.from(resvg.render().asPng())
}

/**
 * Wrap a single PNG image inside a standard ICO container (22-byte header:
 * 6-byte ICONDIR + 16-byte ICONDIRENTRY, followed by the raw PNG bytes).
 */
function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(22)
  // ICONDIR
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = icon
  header.writeUInt16LE(1, 4) // image count
  // ICONDIRENTRY
  header.writeUInt8(size >= 256 ? 0 : size, 6) // width
  header.writeUInt8(size >= 256 ? 0 : size, 7) // height
  header.writeUInt8(0, 8) // color palette count
  header.writeUInt8(0, 9) // reserved
  header.writeUInt16LE(1, 10) // color planes
  header.writeUInt16LE(32, 12) // bits per pixel
  header.writeUInt32LE(png.byteLength, 14) // PNG payload size
  header.writeUInt32LE(22, 18) // byte offset to image data
  return Buffer.concat([header, png])
}

const logoInner = readLogoInner()

// 1. Adaptive vector favicon
const faviconSvg = buildFaviconSvg(logoInner)
writeFileSync(resolve(PUBLIC, 'favicon.svg'), faviconSvg)

// 2. 32px PNG wrapped in ICO (darkroom rounded badge reads on both light and dark tabs)
const icoSvg = buildTiledSvg(logoInner, { rounded: true, padFraction: 0.0625 })
const png32 = renderPng(icoSvg, 32)
writeFileSync(resolve(PUBLIC, 'favicon.ico'), pngToIco(png32, 32))

// 3. Opaque darkroom app icons (iOS apple-touch-icon + PWA manifest icons)
const appIconSvg = buildTiledSvg(logoInner, { rounded: false, padFraction: 0.16 })
writeFileSync(resolve(PUBLIC, 'apple-touch-icon.png'), renderPng(appIconSvg, 180))
writeFileSync(resolve(PUBLIC, 'icon-192.png'), renderPng(appIconSvg, 192))
writeFileSync(resolve(PUBLIC, 'icon-512.png'), renderPng(appIconSvg, 512))

console.log('Generated favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png')
