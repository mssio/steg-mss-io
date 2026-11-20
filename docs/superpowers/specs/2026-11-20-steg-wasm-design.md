# steg.mss.io v2: client-side React + WASM — design

Status: draft for approval · 2026-11-20
Source brief: `../docs/steg-wasm-brief.md` (approved, every decision final). This document restates the brief so it can be built from alone, and records the decisions made since.

## 1. Intent

Replace two repos — `mssio/steg-mss-io` (Bun + React frontend proxying to an API) and `mssio/steg-api-mss-io` (FastAPI wrapper around a Python script) — with one static site in this repo. All steganography runs in the browser through a Rust core compiled to WebAssembly.

Why: no backend to run, no API token, and the password, message and image never leave the user's device.

### Goals
- Hide a ≤500-character message in a PNG or JPEG under a password, and reveal it again, entirely client-side.
- Hidden messages survive JPEG recompression (quality 75–92) of an unresized image.
- A crafted, modern UI designed from scratch ("hidden in plain sight", darkroom aesthetic), good on a 360px phone and a 1440px desktop, in dark and light themes.
- Honest communication of limits.

### Non-goals
- Reading images produced by the old Python API (format v0). The owner will decide separately.
- The Python script's `deflate` mode and `create-cover`.
- Surviving resizing, cropping or screenshots (the block grid would no longer line up).

### Anti-goals (failure even if it "works")
- Any network request carrying image, message or password data, or any request to a third-party origin.
- Anything reused from the old frontend: components, styles, pages, theme, logo or layout. The old UI is explicitly considered not good.
- A backend or Bun server of any kind. Bun is only the local package manager and script runner.
- A UI that looks like a stock shadcn template.
- Logging the message, password or image anywhere, including `console.*`.

## 2. Constraints

- Build in this repo (a fresh Vite + React + TS scaffold made with Bun). Adapt its config; don't re-scaffold over it.
- `public/hero.webp`, `public/og-art.png`, `public/samples/*.jpg` are final: never modify them. `public/favicon.svg` and `public/icons.svg` are template leftovers and get replaced or deleted.
- The old API repo is a read-only reference (cloned to `../reference/steg-api-mss-io`); port the logic, copy no files.
- CSP (below) forbids third-party fonts and scripts, and needs `'wasm-unsafe-eval'`.
- Tooling to install: `wasm-pack` and the `wasm32-unknown-unknown` rustup target (neither is present yet).

## 3. Stack

- Vite + React 19 + TypeScript. Bun for `bun install` / `bun run`. Keep the scaffold's React Compiler (babel preset) and oxlint.
- Tailwind CSS v4 via `@tailwindcss/vite`; shadcn/ui initialised fresh (`bunx shadcn@latest init`) with a custom theme.
- React Router v7 (library mode, `createBrowserRouter`).
- Fonts via `@fontsource-variable/instrument-serif` (or `@fontsource/instrument-serif` if no variable build exists), `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`.
- `sonner` toasts, `lucide-react` icons.
- Rust crate built with `wasm-pack build --target web --out-dir ../../src/wasm` (output in `src/wasm/`, git-ignored), loaded inside a Web Worker by calling its `init()`. No `vite-plugin-wasm`.

## 4. Layout

```
crates/steg-core/
  Cargo.toml
  src/lib.rs          # wasm-bindgen exports, thin
  src/payload.rs      # format v1, KDF, AES-GCM
  src/blocks.rs       # block orders, embed/extract
  src/ecc.rs          # Hamming(7,4), bit packing, majority vote
  src/image_io.rs     # decode, EXIF orientation, encode, 40 MP limit
  tests/              # integration tests + fixtures
  examples/eval.rs    # encoder evaluation harness (§6.6)
src/
  main.tsx, router.tsx
  pages/              # Studio (hide/reveal), HowItWorks
  components/         # Dropzone, CapacityMeter, CompareSlider, ...
  components/ui/      # shadcn components
  lib/steg-client.ts
  workers/steg.worker.ts
  wasm/               # generated, git-ignored
scripts/og.ts
public/
deploy/security-headers.ts   # single source of the response headers
public/_headers              # Cloudflare (Workers assets / Pages) and Netlify
wrangler.jsonc, vercel.json
index.html, vite.config.ts, README.md, CLAUDE.md
```

## 5. Approaches considered

**Embedding encoder** (the one open technical choice; the rest of the how was fixed by the brief):

1. **Python scheme exactly** — fixed ±25 centre/edge offset. Measured on the three sample photos, embedding random bits then re-saving: raw bit error 1.3% (still-life), 3.6% (landscape), 5.6% (street), about the same at q92, q85 and q75. With AES-GCM, a single residual bit error is total failure; at 5.6% a 500-character message would reveal roughly 1 time in 6. Rejected.
2. **Adjusted encoder (chosen by the owner)** — same decoder, but the encoder pre-compensates each block's natural centre/edge contrast so the post-embedding difference reaches the target. Measured 0 raw bit errors on all three samples at q92, q85 and q75. Cost: heavier edits in the most textured blocks.
3. **Adjusted with a cap (~2× strength)** — subtler worst-case edits, but some very busy blocks may still flip. Kept as a variant in the evaluation harness, not the default.

The owner asked that the choice be tested to confirm it is the best: see §6.6.

## 6. Rust core (format v1)

### 6.1 Image handling (`image` crate, features `png` and `jpeg` only)
- Decode in Rust, never via canvas.
- Check dimensions from the decoder before decoding pixels; reject over 40,000,000 pixels with "Image is too large (max 40 megapixels)."
- **Hide:** read the EXIF orientation (`ImageDecoder::orientation()`) and apply it to the pixels, so the output is upright. The output carries no EXIF.
- **Reveal and capacity:** ignore EXIF (our output never has it; capacity is computed on the oriented dimensions for hide, so `capacity()` also applies orientation — it describes what `hide` will do).
- Convert to RGB8 (alpha dropped).
- Output matches the input format: PNG→PNG, JPEG→JPEG at quality 92. Unsupported formats: "Only PNG and JPEG images are supported."
- Work in `f32` pixel buffers for embedding, clamp and round to u8 at the end.

### 6.2 Payload

```
HEADER (public block order)          BODY (password-derived block order)
version  u8 = 0x01                   length  u16 BE = ciphertext length incl. 16-byte tag
salt     16 bytes (random)           nonce   12 bytes (random)
                                     ciphertext || tag
```

- Randomness from `getrandom` (feature `js` / `wasm_js` for the browser target).
- Master key = PBKDF2-HMAC-SHA256(password UTF-8, salt, 600,000 iterations, 32 bytes).
- HKDF-SHA256 (`hkdf`, IKM = master key, no salt): `info="steg-mss-io/v1/order"` → 32-byte order seed; `info="steg-mss-io/v1/aes"` → 32-byte AES key.
- AES-256-GCM (`aes-gcm`), AAD = `version || salt`.
- Wrong password, corrupt image, unknown version, out-of-range length and GCM failure all return one error: "No message found, or the password is wrong." Never distinguish them.
- Message limit: 500 Unicode code points (Rust `chars().count()`; JS `[...text].length`), plus the byte cap from capacity (UTF-8).
- Empty message or empty password: rejected before any work ("Enter a message." / "Enter a password.").

### 6.3 Bits, ECC and block layout
- Bytes → bits MSB first. Hamming(7,4) per nibble with codeword order `p1 p2 d1 p3 d2 d3 d4`, `p1=d1^d2^d4`, `p2=d1^d3^d4`, `p3=d2^d3^d4`; decoding corrects one bit via syndrome `s1 + 2·s2 + 4·s3`. Byte-aligned payloads give whole nibbles, so no padding.
- Redundancy 3: each coded bit goes into 3 consecutive blocks of its order list; reveal takes the majority.
- Blocks: 8×8, numbered row-major over `floor(w/8) × floor(h/8)`; leftover edge pixels untouched. Centre region = rows/cols 2..6 (4×4), edge = the other 48 pixels.
- Luminance `Y = 0.299R + 0.587G + 0.114B`; bit read as `mean(Y_centre) − mean(Y_edge) > 0`.
- Header = 17 bytes → 238 coded bits → **714 blocks**. Header order: `ChaCha20Rng::from_seed(SHA-256("steg-mss-io/v1/header"))`, Fisher–Yates over all block indices, take the first 714.
- Body order: `ChaCha20Rng::from_seed(order seed)`, Fisher–Yates over the remaining blocks (ascending index order before shuffling).
- Fisher–Yates is written by hand (descending `i`, `j = rng.gen_range(0..=i)` via a fixed, documented method such as `next_u64() % (i+1)` with rejection) so the order never depends on `rand` version internals. Pin `rand_chacha` exactly.

### 6.4 Embedding (adjusted encoder)
For each block and its target bit `t = +S` (1) or `−S` (0), `S = 25`:
1. Measure the block's natural difference `d = mean(Y_c) − mean(Y_e)` on the current pixels.
2. Offset `o = t` if `d` already has the target's sign, otherwise `o = t − d` (so the result lands at about `t`).
3. Add `o/2` to every centre pixel and subtract `o/2` from every edge pixel, equally in R, G and B (so Y shifts by the same amount).
4. **Clipping compensation:** after clamping to [0, 255], recompute the difference; if it falls short of `|t|` in the right direction, push the unclamped region further until the target is met or both regions saturate.

The decoder is unchanged from the Python script. Final numeric details (e.g. a small safety margin above `S`) may be tuned by the evaluation in §6.6; the decoder and format must not change.

### 6.5 Capacity, hide and reveal
- `avail = total_blocks − 714`. Max body bytes `B = floor(floor(avail / 21) / 2)` (21 blocks per nibble). Max message bytes `M = B − 30`. `capacity() = clamp(min(500, M), 0)`, no KDF. If `M < 1`: "This image is too small to hold a message."
- On hide, if the message's UTF-8 length exceeds `M` or its code points exceed 500: "This image can hold at most N characters." (N = `min(500, M)`).
- **Reveal:** read the 714 header blocks → decode → check version `0x01` → PBKDF2 once → body order → read the first 84 blocks (length) → validate `16 ≤ length ≤ 2016` and that it fits `avail` → read only the blocks needed → AES-GCM decrypt → UTF-8.

### 6.6 Encoder evaluation ("make sure it's the best")
`cargo run --release --example eval` prints a table per image × variant × recompression:
- Images: the three samples in `public/samples/`, the test fixtures (small photo, flat colour, near-white, near-black, high-contrast texture/text).
- Variants: Python baseline, adjusted (§6.4), adjusted + cap 2S, adjusted + margin (e.g. target 1.2·S).
- Recompression: none, JPEG q92, q85, q75, plus chained q85→q75.
- Metrics: raw bit error rate (random bits in every block); end-to-end reveal success over 20 random password/message pairs at 500 chars; distortion as PSNR and the share of blocks with offset > 2S.

**Gate (must pass):** the three samples plus the small-photo and flat-colour fixtures, single recompression at q92, q85 and q75: zero end-to-end reveal failures. **Reported, not gated:** chained q85→q75 and the stress fixtures (near-white, near-black, text/texture), where raw errors are allowed as long as ECC + majority vote absorb them, and the rate is recorded.

The default is the variant that passes the gate with the least distortion, with stress results as a tiebreaker. If adjusted isn't it, switch and say why in the commit. If no variant passes the gate, stop and ask the owner (fixing it would need a format or decoder change). The results table goes into `crates/steg-core/EVAL.md`. A regression test asserts that the chosen encoder passes the gate cases at q75.

### 6.7 wasm-bindgen API
```rust
hide(image: &[u8], message: &str, password: &str) -> Result<HideResult, JsError>
// HideResult { bytes: Vec<u8>, mime: String, blocks_used: u32, blocks_total: u32 } (getters)
reveal(image: &[u8], password: &str) -> Result<String, JsError>
capacity(image: &[u8]) -> Result<u32, JsError>
diff_preview(original: &[u8], stego: &[u8]) -> Result<Vec<u8>, JsError>
// PNG of |original − stego| per channel × 8, clamped; original is oriented like hide does
```
`blocks_used` = 714 + body blocks. Core logic sits behind plain Rust functions so native tests don't need wasm.

### 6.8 Tests (`cargo test`, native)
- Round trip on PNG and JPEG fixtures (small photo, flat colour).
- Round trip survives re-encoding the output as JPEG q75 and q85.
- Wrong password → the generic error.
- Header and body block sets never overlap; body order changes with the password, header order does not.
- Multi-byte message (emoji, non-Latin) round-trips; byte cap enforced.
- Too-small image → capacity error.
- EXIF-rotated JPEG fixture (orientation 6): output dimensions match the displayed orientation; reveal works.
- Encoder regression test from §6.6.
- Fixtures are generated by a small test helper where possible (flat colour, EXIF injected by writing an APP1 segment) and committed when small; tests run PBKDF2 at full cost in `--release`-like profile (`[profile.test] opt-level = 3` for the crate) to keep them fast.

## 7. Frontend plumbing
- `steg.worker.ts`: imports the wasm-pack JS glue and the `.wasm` URL (`?url`), calls `init()` once, then handles `{ id, op, ...args }` and replies `{ id, ok, result | error }`. `ArrayBuffer`s are transferred both ways.
- `steg-client.ts`: one lazy worker; typed `hide()`, `reveal()`, `capacity()`, `diffPreview()` returning promises. Error messages pass through unchanged (they're already user-facing).
- Each call sends a fresh copy of the image bytes (the original `File`/`Blob` stays in state; `await blob.arrayBuffer()` each time) so transfers never detach the state.
- Results are `Blob`s with object URLs, revoked on unmount and on reset.
- No logging of user data; the password field clears after every hide and reveal, success or failure.
- Status: "Deriving key…" shown for the whole hide/reveal call (the wasm call can't report progress mid-way); capacity runs on load and is debounced.

## 8. UI and UX (from scratch)

**Concept:** "hidden in plain sight", a photo-darkroom feel — ink-black surfaces, warm safelight-amber accent, subtle film grain, precise technical readouts in monospace. Modern and deliberately composed, not a template: generous whitespace, a strong serif display headline, hairline borders, restrained motion.

- **Theme:** dark default; light "paper" mode. Toggle in the header; respects `prefers-color-scheme`; choice in `localStorage` inside try/catch; applied before first paint by an external `/theme-init.js` in `public/`, loaded synchronously in `<head>` (CSP forbids inline scripts; no theme flash).
  - Dark: bg `#0D0E0C`, surface `#171814`, text `#ECE8DF`, muted `#8A877F`, accent `#FFB547`.
  - Light: bg `#F4F1EA`, text `#1A1A17`, accent `#B86E00`. All pairs adjusted as needed to pass WCAG AA.
  - Grain: CSS-only SVG noise data URI at ~4% opacity, fixed overlay, `pointer-events: none`.
- **Type:** Instrument Serif for display, Geist for UI, Geist Mono for readouts.
- **Studio page** (`/` = Hide, `/reveal` = Reveal):
  - Short hero with `hero.webp` behind/beside the headline at low emphasis (`object-fit: cover`, headline over the dark right side): headline e.g. "Hide a message inside a photo.", one line of subtext, a privacy badge "Runs entirely in your browser. Nothing is uploaded." opening a popover that explains how.
  - Segmented control Hide | Reveal (route links).
  - Desktop: image stage ~60% left, controls right. Mobile: stacked, primary action in a sticky bottom bar.
  - Image stage: dropzone (drag-drop, click, paste anywhere with Ctrl/Cmd+V); "Try a sample" chips for the three samples; preview with mono caption (dimensions · format · size); amber scanline sweep while working (off under reduced motion); after hide, a before/after compare slider (keyboard operable) and a "Show difference" toggle using `diff_preview`, with an honest note that the pattern is subtly visible.
  - Hide controls: message textarea + capacity meter (bar + `128 / 412 chars`, amber near the limit ≥ 90%, red over; shows bytes too once the text has multi-byte characters); password with show/hide, a simple strength hint, and "Generate" (random passphrase from a built-in word list via `crypto.getRandomValues`, copied to clipboard with a toast); primary "Hide message"; result card with download (`<original-name>-steg.<ext>`), Share (Web Share API with files when `navigator.canShare({files})`), and the delivery tip "Send as a file or document on WhatsApp/Telegram for the best chance the message survives."
  - Reveal controls: dropzone + password → "Reveal"; message card with typewriter fade-in (instant under reduced motion), Copy, and Clear (wipes it). One generic friendly error.
- **How it works** (`/how-it-works`): plain-language explanation; inline SVG diagram (message → encrypt → error correction → embed in 8×8 blocks); a platform table; an honest limits section (it hides and encrypts, but an analyst can tell the image was altered; security depends on the password; resizing destroys the message).
  - Platform table content (builder's call, stated honestly as expected behaviour, not tested guarantees): sending as a file/document keeps the message; sending as a photo usually breaks it on apps that resize (WhatsApp, Telegram, Instagram, Facebook); X/Twitter keeps it only if the image isn't resized; screenshots and crops always break it.
- **Footer:** How it works link, source link to `https://github.com/mssio/steg-mss-io`, "No cookies, no analytics, no uploads."
- **Quality bar:** keyboard accessible with accent focus rings; `aria-live` for status and results; labelled inputs; AA contrast in both themes; works at 360px; Lighthouse ≥ 95 accessibility and best practices; motion 150–250 ms.
- **Review checkpoint (hard stop):** after milestone 2, share screenshots at 360px and 1440px in both themes and wait for the owner's feedback before starting milestone 3.

## 9. Assets
- `public/logo.svg`: hand-made geometric eye/aperture whose iris is a 3×3 grid of squares, one in the accent colour; must read at 16px. Derive `favicon.svg`, `favicon.ico` (32px), `apple-touch-icon.png` (180px) and `site.webmanifest` (rasterised with `@resvg/resvg-js` in a script).
- `scripts/og.ts` (`@resvg/resvg-js`): composite logo + title "steg.mss.io: hide a message inside a photo" onto `og-art.png` (empty dark left side) → `public/og-image.png`. Fonts for the OG render are loaded from the fontsource packages' files. Open Graph + Twitter card meta tags in `index.html` with absolute URLs on `https://steg.mss.io`.

## 10. Build and deploy

The output is a plain static `dist/`. The host is not decided yet (likely Vercel or Cloudflare Workers static assets), so the site stays host-neutral: no Docker, no nginx, no server. (Change from the brief, decided by the owner on 2026-11-20.)

- Scripts: `wasm`, `dev` (runs `wasm` if `src/wasm` is missing, then Vite), `build` (`wasm` → `tsc -b` → `vite build`), `preview` (`vite preview` with production headers), `test` (`cargo test --manifest-path crates/steg-core/Cargo.toml` and `bun test src`), `og`, `icons`, `deploy:cf` (`wrangler deploy`, optional).
- **Headers, one source:** `deploy/security-headers.ts` exports the header map below. It is used by `vite.config.ts` for `preview.headers` (so the CSP is exercised locally before any deploy). `public/_headers` and `vercel.json` hold literal copies, and a `bun test` fails if either drifts from the source.
  - `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`
  - `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Cloudflare:** `public/_headers` (`/*` rule with the headers; `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`) is copied into `dist/`. `wrangler.jsonc`: assets-only Worker, `assets.directory = "./dist"`, `assets.not_found_handling = "single-page-application"`, no Worker script (so `_headers` applies to every response).
- **Vercel:** `vercel.json` with `rewrites` `/(.*)` → `/index.html` (filesystem first), the same headers on `/(.*)`, immutable cache on `/assets/(.*)`. Vercel's build image has no Rust toolchain, so the README documents building locally or in CI and deploying the prebuilt `dist/`.
- `.wasm` gets `application/wasm` from both hosts and from Vite by default; verify it in preview.
- SPA deep links (`/reveal`, `/how-it-works`) must return `index.html` with 200 on both hosts.

## 11. Milestones (commit after each)
1. Rust core + native tests + encoder evaluation (EVAL.md).
2. Vite + Tailwind + shadcn scaffold, theme, fonts, layout, Studio and How it works with stub functions → screenshots, then **stop for the owner's review**.
3. Worker + WASM wired; manual round trip in the browser incl. compare slider and difference view.
4. Logo, favicons, OG script, meta tags; polish pass on a11y, mobile, reduced motion.
5. Host-neutral deploy config (headers source, `_headers`, `wrangler.jsonc`, `vercel.json`, preview headers, drift test), README.md, CLAUDE.md.

## 12. Done when
- `bun run build` produces a static `dist/` with no server code.
- `cargo test` passes, including recompression and EXIF tests; EVAL.md shows the chosen encoder with zero errors.
- In the browser, a message hidden in a phone JPEG reveals after the download is re-saved as JPEG q85.
- `bun run preview` serves the production headers, deep links work, and a hide/reveal round trip runs with no CSP errors.
- The network tab shows no requests with image/message/password data and none to third-party origins.
- Both themes look intentional at 360px and 1440px; screenshots in the final summary.

## 13. Calls made since the brief (for the owner to check)
- Encoder: adjusted (owner's choice), with clipping compensation, verified by the evaluation harness.
- `favicon.svg` / `icons.svg` from the template are replaced/deleted.
- Reveal ignores EXIF; hide and capacity apply it.
- "Deriving key…" covers the whole operation.
- WASM output in `src/wasm/`, git-ignored.
- Fisher–Yates hand-written over `ChaCha20Rng` with a pinned crate version, for stable orders.
- Platform table phrased as expected behaviour; resizing called out as a limit.
- Encoder gate: zero reveal failures on samples + core fixtures at single q92/85/75; chained recompression and stress fixtures are reported only.
- No Docker/nginx; host-neutral static deploy with configs for Cloudflare and Vercel (owner's decision).
- Theme set before first paint by an external `/theme-init.js` (CSP forbids inline scripts).
