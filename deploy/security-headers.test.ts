import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { immutableCache, securityHeaders } from './security-headers.ts'

const rootDir = path.resolve(import.meta.dir, '..')

function parseCloudflareHeaders(content: string): Map<string, Record<string, string>> {
  const blocks = new Map<string, Record<string, string>>()
  let currentPath: string | null = null

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (!/^\s/.test(rawLine)) {
      currentPath = trimmed
      if (!blocks.has(currentPath)) {
        blocks.set(currentPath, {})
      }
      continue
    }

    if (!currentPath) {
      throw new Error(`Header line before any path block: ${rawLine}`)
    }

    const colonIndex = rawLine.indexOf(':')
    if (colonIndex === -1) {
      throw new Error(`Malformed header line: ${rawLine}`)
    }

    const name = rawLine.slice(0, colonIndex).trim()
    const value = rawLine.slice(colonIndex + 1).trim()
    const block = blocks.get(currentPath)!
    if (name in block) {
      throw new Error(`Duplicate header ${name} in block ${currentPath}`)
    }
    block[name] = value
  }

  return blocks
}

function stripLineComments(jsonc: string): string {
  let out = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < jsonc.length; i++) {
    const ch = jsonc[i]!
    const next = jsonc[i + 1]

    if (inString) {
      out += ch
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      out += ch
      continue
    }

    if (ch === '/' && next === '/') {
      while (i < jsonc.length && jsonc[i] !== '\n') {
        i++
      }
      if (i < jsonc.length && jsonc[i] === '\n') {
        out += '\n'
      }
      continue
    }

    out += ch
  }

  return out
}

interface VercelHeaderEntry {
  source: string
  headers: Array<{ key: string; value: string }>
}

interface VercelConfig {
  installCommand?: string
  buildCommand?: string
  outputDirectory?: string
  headers?: VercelHeaderEntry[]
  rewrites?: Array<{ source: string; destination: string }>
}

interface WranglerConfig {
  name?: string
  compatibility_date?: string
  main?: string
  assets?: {
    directory?: string
    not_found_handling?: string
  }
}

describe('deploy config parity', () => {
  it('cloudflare_headers_match', () => {
    const raw = readFileSync(path.join(rootDir, 'public', '_headers'), 'utf8')
    const blocks = parseCloudflareHeaders(raw)

    expect(blocks.get('/*')).toEqual(securityHeaders)
    expect(blocks.get('/assets/*')).toEqual({
      'Cache-Control': immutableCache,
    })
  })

  it('vercel_headers_match', () => {
    const raw = readFileSync(path.join(rootDir, 'vercel.json'), 'utf8')
    const config = JSON.parse(raw) as VercelConfig

    const allRule = config.headers?.find((entry) => entry.source === '/(.*)')
    expect(allRule).toBeDefined()
    const allHeaders = Object.fromEntries(
      (allRule?.headers ?? []).map(({ key, value }) => [key, value]),
    )
    expect(allRule?.headers.length).toBe(Object.keys(allHeaders).length)
    expect(allHeaders).toEqual(securityHeaders)

    const assetsRule = config.headers?.find((entry) => entry.source === '/assets/(.*)')
    expect(assetsRule).toBeDefined()
    const assetsHeaders = Object.fromEntries(
      (assetsRule?.headers ?? []).map(({ key, value }) => [key, value]),
    )
    expect(assetsHeaders).toEqual({
      'Cache-Control': immutableCache,
    })

    expect(config.rewrites).toContainEqual({
      source: '/((?!assets/).*)',
      destination: '/index.html',
    })
  })

  it('vercel_build_config', () => {
    const raw = readFileSync(path.join(rootDir, 'vercel.json'), 'utf8')
    const config = JSON.parse(raw) as VercelConfig & Record<string, unknown>

    expect(config.installCommand).toBe('sh scripts/vercel-install.sh')
    expect(config.installCommand!.length).toBeLessThanOrEqual(256)
    expect(config.buildCommand).toBeDefined()
    expect(config.buildCommand!.length).toBeLessThanOrEqual(256)

    for (const [key, value] of Object.entries(config)) {
      if (key.endsWith('Command') && typeof value === 'string') {
        expect(value.length).toBeLessThanOrEqual(256)
      }
    }

    const installScript = readFileSync(path.join(rootDir, 'scripts', 'vercel-install.sh'), 'utf8')
    expect(installScript).toContain('set -eu')
    expect(installScript).toContain('rustup toolchain install stable')
    expect(installScript).toContain('--target wasm32-unknown-unknown')
    expect(installScript).toContain('rustup default stable')
    expect(installScript).toContain('cargo install wasm-pack --version 0.15.1 --locked')
    expect(installScript).toContain('wasm-pack --version')
    expect(installScript).toContain('bun install --frozen-lockfile')
    expect(installScript).not.toContain('sh.rustup.rs')
    expect(installScript).not.toContain('.cargo/env')

    expect(config.buildCommand).toContain('bun run build')
    expect(config.buildCommand).not.toContain('.cargo/env')

    expect(config.outputDirectory).toBe('dist')
  })

  it('wrangler_spa', () => {
    const raw = readFileSync(path.join(rootDir, 'wrangler.jsonc'), 'utf8')
    const config = JSON.parse(stripLineComments(raw)) as WranglerConfig

    expect(config.assets?.directory).toBe('./dist')
    expect(config.assets?.not_found_handling).toBe('404-page')
    expect('main' in config).toBe(false)

    const redirectsRaw = readFileSync(path.join(rootDir, 'public', '_redirects'), 'utf8')
    const rules = redirectsRaw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
    expect(rules).toContain('/reveal / 200')
    expect(rules).toContain('/reveal/ / 200')
    expect(rules).toContain('/how-it-works / 200')
    expect(rules).toContain('/how-it-works/ / 200')
    expect(rules.some((line) => line.startsWith('/assets/') || line.startsWith('/*'))).toBe(false)

    const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    expect(pkg.scripts?.build).toContain('cp dist/index.html dist/404.html')
  })
})
