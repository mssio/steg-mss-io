import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { Resvg } from '@resvg/resvg-js'

const ROOT = resolve(import.meta.dir, '..')
const PUBLIC = resolve(ROOT, 'public')

const WIDTH = 1200
const HEIGHT = 630

/**
 * Decode a WOFF 1.0 buffer into a standard SFNT (TTF/OTF) buffer so resvg
 * can load fonts directly from the installed @fontsource packages without
 * network fetches or external binaries.
 */
function woffToSfnt(woff: Buffer): Buffer {
  if (woff.toString('ascii', 0, 4) !== 'wOFF') {
    throw new Error('Expected a WOFF 1.0 font file')
  }

  const flavor = woff.readUInt32BE(4)
  const numTables = woff.readUInt16BE(12)

  interface TableEntry {
    tag: Buffer
    origChecksum: number
    data: Buffer
    origLength: number
  }

  const tables: TableEntry[] = []
  for (let i = 0; i < numTables; i++) {
    const entryOffset = 44 + i * 20
    const tag = woff.subarray(entryOffset, entryOffset + 4)
    const offset = woff.readUInt32BE(entryOffset + 4)
    const compLength = woff.readUInt32BE(entryOffset + 8)
    const origLength = woff.readUInt32BE(entryOffset + 12)
    const origChecksum = woff.readUInt32BE(entryOffset + 16)

    const slice = woff.subarray(offset, offset + compLength)
    const data = compLength < origLength ? inflateSync(slice) : slice
    if (data.byteLength !== origLength) {
      throw new Error(`WOFF table ${tag.toString('ascii')} length mismatch`)
    }
    tables.push({ tag, origChecksum, data, origLength })
  }

  let maxPow2 = 1
  let entrySelector = 0
  while (maxPow2 * 2 <= numTables) {
    maxPow2 *= 2
    entrySelector += 1
  }
  const searchRange = maxPow2 * 16
  const rangeShift = numTables * 16 - searchRange

  const headerSize = 12 + numTables * 16
  let dataOffset = headerSize
  const tableOffsets: number[] = []
  for (const t of tables) {
    tableOffsets.push(dataOffset)
    dataOffset += (t.origLength + 3) & ~3
  }

  const out = Buffer.alloc(dataOffset)
  out.writeUInt32BE(flavor, 0)
  out.writeUInt16BE(numTables, 4)
  out.writeUInt16BE(searchRange, 6)
  out.writeUInt16BE(entrySelector, 8)
  out.writeUInt16BE(rangeShift, 10)

  for (let i = 0; i < numTables; i++) {
    const t = tables[i]
    const recordOffset = 12 + i * 16
    t.tag.copy(out, recordOffset)
    out.writeUInt32BE(t.origChecksum, recordOffset + 4)
    out.writeUInt32BE(tableOffsets[i], recordOffset + 8)
    out.writeUInt32BE(t.origLength, recordOffset + 12)
    t.data.copy(out, tableOffsets[i])
  }

  return out
}

function readLogoInner(): string {
  const raw = readFileSync(resolve(PUBLIC, 'logo.svg'), 'utf8')
  const match = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)
  if (!match) throw new Error('Could not parse public/logo.svg')
  return match[1].trim()
}

const fontDir = mkdtempSync(join(tmpdir(), 'steg-og-fonts-'))

try {
  const fontSources = [
    {
      src: resolve(
        ROOT,
        'node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff',
      ),
      out: join(fontDir, 'instrument-serif-400.ttf'),
    },
    {
      src: resolve(
        ROOT,
        'node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff',
      ),
      out: join(fontDir, 'instrument-serif-400-italic.ttf'),
    },
    {
      src: resolve(
        ROOT,
        'node_modules/@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff',
      ),
      out: join(fontDir, 'geist-mono-400.ttf'),
    },
  ]

  const fontFiles: string[] = []
  for (const font of fontSources) {
    writeFileSync(font.out, woffToSfnt(readFileSync(font.src)))
    fontFiles.push(font.out)
  }

  const artBase64 = readFileSync(resolve(PUBLIC, 'og-art.png')).toString('base64')
  const logoInner = readLogoInner()

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="scrim" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0D0E0C" stop-opacity="0.82" />
      <stop offset="44%" stop-color="#0D0E0C" stop-opacity="0.68" />
      <stop offset="68%" stop-color="#0D0E0C" stop-opacity="0" />
    </linearGradient>
  </defs>

  <image href="data:image/png;base64,${artBase64}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice" />
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#scrim)" />

  <!-- Subtle darkroom corner registration marks -->
  <g stroke="#3A3A34" stroke-width="1.5" stroke-opacity="0.7" fill="none">
    <path d="M36 56 V36 H56" />
    <path d="M1144 36 H1164 V56" />
    <path d="M36 574 V594 H56" />
    <path d="M1144 594 H1164 V574" />
  </g>

  <!-- Brand mark -->
  <g transform="translate(76 74) scale(1.75)">
    ${logoInner}
  </g>

  <!-- Title in Instrument Serif -->
  <text
    x="76"
    y="228"
    font-family="Instrument Serif"
    font-size="48"
    fill="#FFB547"
    letter-spacing="-0.4"
  >steg.mss.io:</text>

  <text
    x="76"
    y="328"
    font-family="Instrument Serif"
    font-size="94"
    fill="#ECE8DF"
    letter-spacing="-1.6"
  >hide a message</text>

  <text
    x="76"
    y="420"
    font-family="Instrument Serif"
    font-size="94"
    fill="#ECE8DF"
    letter-spacing="-1.6"
  >inside a <tspan font-style="italic">photo</tspan></text>

  <!-- Hairline rule + technical readout -->
  <line x1="76" y1="484" x2="536" y2="484" stroke="#3A3A34" stroke-width="1" />

  <circle cx="82" cy="524" r="4" fill="#FFB547" />
  <text
    x="100"
    y="530"
    font-family="Geist Mono"
    font-size="16"
    fill="#928F86"
    letter-spacing="1.6"
  >RUNS IN YOUR BROWSER · NOTHING UPLOADED</text>
</svg>`

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: 'Instrument Serif',
    },
  })

  const png = resvg.render().asPng()
  writeFileSync(resolve(PUBLIC, 'og-image.png'), png)
  console.log(`Generated public/og-image.png (${WIDTH}x${HEIGHT}, ${png.byteLength} bytes)`)
} finally {
  rmSync(fontDir, { recursive: true, force: true })
}
