# steg.mss.io

Hide an encrypted message inside a PNG or JPEG photo, and reveal it again — entirely in the browser.

Live site: [steg.mss.io](https://steg.mss.io) · Source: [github.com/mssio/steg-mss-io](https://github.com/mssio/steg-mss-io)

## What it does

- Embeds up to 500 Unicode characters (bounded by image size) into a PNG or JPEG photo using an 8×8 luminance-block scheme (public format header + password-keyed body) with Hamming(7,4) error correction and 3× majority voting.
- Encrypts messages with AES-256-GCM using keys derived via PBKDF2-HMAC-SHA256 (600,000 iterations) and HKDF-SHA256, compiled from Rust (`crates/steg-core`) to WebAssembly and run off the main thread in a Web Worker.
- Survives JPEG recompression (quality 75–92) of an unresized image. Resizing, cropping, or taking a screenshot breaks the 8×8 block grid and destroys the message.

## Privacy model

- **Client-side only:** there is no backend, no API, and no server code. Your image, message, and password never leave your device.
- **No tracking:** no cookies, no analytics, and no third-party requests (fonts and icons are bundled locally).
- **Strict CSP:** `default-src 'self'`, no inline scripts, and no third-party origins (only `'wasm-unsafe-eval'` for WebAssembly compilation).
- **Clean state:** password fields clear after every hide or reveal attempt, and all reveal failures (wrong password, missing message, corrupted image) return the same generic error.

## Development

### Prerequisites

- [Bun](https://bun.sh)
- [Rust](https://www.rust-lang.org/tools/install) with the `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)
- [`wasm-pack`](https://rustwasm.github.io/wasm-pack/installer/)

### Commands

```sh
# Install JS dependencies
bun install

# Start the dev server (builds src/wasm/ automatically if missing)
bun run dev

# Rebuild the Rust WASM package explicitly
bun run wasm

# Run all tests (Rust crate + Bun unit & deploy parity tests)
bun run test

# Lint TypeScript/React
bun run lint

# Production build (WASM -> TypeScript check -> Vite static bundle in dist/)
bun run build

# Preview dist/ locally with production security headers (http://localhost:4173)
bun run preview
```

Optional asset generation scripts (only needed when updating `public/logo.svg` or the Open Graph layout):

```sh
bun run icons   # Regenerate favicons, app icons, and site.webmanifest from public/logo.svg
bun run og      # Regenerate public/og-image.png from public/og-art.png
```

## Deploy

`dist/` is a static site; deploy it to any static host.

### Cloudflare Workers (static assets)

```sh
bun run deploy:cf
```

This runs `bun run build` (which copies `dist/index.html` to `dist/404.html`) and `wrangler deploy` using [`wrangler.jsonc`](wrangler.jsonc) as an assets-only Worker (`assets.directory = "./dist"`, `assets.not_found_handling = "404-page"`, no Worker script). Vite copies [`public/_headers`](public/_headers) and [`public/_redirects`](public/_redirects) into `dist/`; Cloudflare applies `_headers` to every response for security headers and immutable `/assets/*` caching, `_redirects` proxies the SPA routes (`/reveal`, `/how-it-works`) to `/` with HTTP 200, and unmatched paths serve `dist/404.html` with HTTP 404 so unknown routes render the app's NotFound page while missing `/assets/*` return 404 instead of 200.

### Vercel

[`vercel.json`](vercel.json) configures the full build (`installCommand`, `buildCommand`, and `outputDirectory: "dist"`), along with the security headers, immutable `/assets/*` caching, and SPA fallback rewrite (`/((?!assets/).*)` → `/index.html`, excluding `/assets/` so missing assets return 404). Because Vercel's default build image does not include Rust, `installCommand` installs the minimal Rust toolchain (`wasm32-unknown-unknown` target) and `wasm-pack` on each build before running `bun install --frozen-lockfile`, and `buildCommand` sources Cargo's environment and runs `bun run build`. Dashboard overrides are not needed — leave the Build and Install command fields un-overridden in Project Settings. Note that installing `wasm-pack` compiles it from source, which adds a few minutes per deploy.

### Other static hosts

1. Run `bun run build` and upload `dist/`.
2. Copy the response headers from [`deploy/security-headers.ts`](deploy/security-headers.ts) onto all routes, and set `Cache-Control: public, max-age=31536000, immutable` on `/assets/*`.
3. Ensure `.wasm` files are served with `Content-Type: application/wasm`.
4. Serve `/index.html` for the app routes (`/reveal`, `/how-it-works`) — or for unknown routes — but never for `/assets/*` (missing hashed assets must return HTTP 404). `bun run build` also writes `dist/404.html` (a copy of `dist/index.html`) for hosts that serve a custom 404 page with HTTP 404.
