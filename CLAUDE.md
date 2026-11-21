# CLAUDE.md

Guidance for coding agents working in `steg-mss-io` ([steg.mss.io](https://steg.mss.io)).

## Overview

`steg-mss-io` is a static React 19 + Vite + TypeScript site with a Rust steganography core (`crates/steg-core`) compiled to WebAssembly (`src/wasm/`, git-ignored) and executed inside a Web Worker. Bun is used only as the package manager, script runner, and TS test runner — there is no backend or server code.

Full design specification: [`docs/superpowers/specs/2026-11-20-steg-wasm-design.md`](docs/superpowers/specs/2026-11-20-steg-wasm-design.md).

## Architecture

### Rust core (`crates/steg-core/`)

Compiled with `wasm-pack build crates/steg-core --target web --release --out-dir ../../src/wasm`. Both `[profile.release]` (`lto = true`) and `[profile.test]` use `opt-level = 3` so 600,000-round PBKDF2 stays fast in WASM and native tests.

- `src/ecc.rs` — MSB-first bit packing (`bytes_to_bits`, `bits_to_bytes`), Hamming(7,4) with codeword layout `p1 p2 d1 p3 d2 d3 d4` (`hamming_encode`, `hamming_decode`), and `majority` vote (`REDUNDANCY = 3`).
- `src/image_io.rs` — PNG/JPEG-only decoding via `image` (`default-features = false, features = ["png", "jpeg"]`), 40,000,000-pixel cap checked from headers before pixel decode, EXIF orientation applied on `hide` and `capacity` (ignored on `reveal`), conversion to RGB8, encoding back to input format (JPEG quality 92).
- `src/blocks.rs` — 8×8 row-major grid (`BLOCK = 8`, `HEADER_BLOCKS = 714`, `STRENGTH = 25.0`), hand-written Fisher–Yates with rejection sampling over pinned `rand_chacha = "=0.10.0"`, `header_order` / `body_order`, luminance `Y = 0.299R + 0.587G + 0.114B` (centre 4×4 vs 48 edge pixels), and encoders (`DEFAULT_ENCODER = Encoder::Adjusted`).
- `src/payload.rs` — format v1 framing, key derivation, AES-256-GCM encryption/decryption, and plain-Rust entrypoints (`hide_core`, `reveal_core`, `capacity_core`, `capacity_detail_core`, `diff_preview_core`).
- `src/error.rs` — `StegError` enum holding the exact user-facing error strings (Rust is the single source of truth; UI displays them verbatim).
- `src/lib.rs` — thin `wasm-bindgen` bindings (`hide`, `reveal`, `capacity`, `capacity_detail`, `diff_preview`, `HideResult`, `CapacityDetail`).
- `examples/eval.rs` & `EVAL.md` — reproducible encoder evaluation harness and decision record. `Encoder::Adjusted` (pre-compensating natural block contrast with clipping compensation) is the default: 0.00% raw bit error rate and 20/20 reveal across all gate, chained, and stress cases.
- `tests/` — native tests (`image_io.rs`, `blocks.rs`, `roundtrip.rs`, `encoder_regression.rs`).

### Format v1 summary

See §6 of [`docs/superpowers/specs/2026-11-20-steg-wasm-design.md`](docs/superpowers/specs/2026-11-20-steg-wasm-design.md) for the complete specification.

- **Header (714 blocks, public order):** `version` (`0x01`, 1 B) + `salt` (16 B random), placed via `ChaCha20Rng::from_seed(SHA-256("steg-mss-io/v1/header"))`.
- **KDF:** PBKDF2-HMAC-SHA256(password UTF-8 bytes as typed, salt, 600,000 iterations, 32 B) → HKDF-SHA256 (no salt) expanding `steg-mss-io/v1/order` (32 B ChaCha20 body order seed) and `steg-mss-io/v1/aes` (32 B AES-256-GCM key).
- **Body (keyed order over remaining blocks):** `length` (`u16` BE = ciphertext + tag length, first 84 body blocks) + `nonce` (12 B random) + `ciphertext || tag` (16 B GCM tag, AAD = `version || salt`).
- **Limits:** 500 Unicode code points (`chars().count()` / `[...text].length`), 40,000,000 pixels, JPEG output quality 92.
- **Format v0** (from the retired Python API) is explicitly out of scope.

### Worker protocol & client

- `src/workers/steg.worker.ts` — module Web Worker importing `../wasm/steg_core.js` and `../wasm/steg_core_bg.wasm?url`. Lazily calls `init()` once, handles `{ id, op: 'hide' | 'reveal' | 'capacity' | 'capacityDetail' | 'diff' | 'warm', ... }` messages with transferable `ArrayBuffer`s both ways, and frees `HideResult` and `CapacityDetail` in `finally`. Plain `Error` instances (Rust `JsError`) pass their message back (`{ id, ok: false, error }`). Any other thrown value (such as a `WebAssembly.RuntimeError` trap) marks the worker `poisoned = true` and replies with `{ id, ok: false, error: <fallback>, fatal: true }`.
- `src/lib/steg-client.ts` & `src/lib/steg-types.ts` — lazy single-worker client (`createStegClient`, default exports `hide`, `reveal`, `capacity`, `capacityDetail`, `diffPreview`, `warm`). Copies fresh `ArrayBuffer`s via `blob.arrayBuffer()` per call so caller `Blob`/`File` state is never detached. On `fatal: true` or worker `error`/`messageerror`, terminates the worker, rejects all pending calls with fallback errors, and spawns a fresh worker on the next call; a `postMessage` throw rejects only that call without killing the worker.

### Frontend UI

- Routing (`src/router.tsx`) inside `src/components/AppShell.tsx`: `/` (`Studio` hide mode), `/reveal` (`Studio` reveal mode), `/how-it-works` (`HowItWorks`), `*` (`NotFound`).
- `src/pages/Studio.tsx` pre-warms the worker on mount via `warm()` and wires `Hero` (`PrivacyBadge`), `ModeSwitch`, `ImageStage` (`Dropzone`, `SampleChips`, `Scanline`, `CompareSlider`) with `DiffToggle`, `HidePanel` (`CapacityMeter`, `PasswordField`, `HideResultCard`), `RevealPanel` (`PasswordField`, `RevealedMessage`), shared `StudioControls` (`PrimaryAction`, `Step`), and mobile `StickyActionBar`.
- Hooks (`src/hooks/`): `useLoadedImage`, `useFileDrop`, `useObjectUrl` (revokes object URLs on reset/unmount), `useRun` (generation guard so stale worker results are dropped if the image or mode changes mid-run).
- Styling & theme: Tailwind CSS v4 (`src/index.css`), darkroom dark default + light paper theme toggled via `src/lib/theme.ts` and initialized before first paint by `public/theme-init.js` (external script because CSP forbids inline scripts). Self-hosted `@fontsource/instrument-serif`, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`.
- Deploy config: `deploy/security-headers.ts` is the single source of truth for response headers and immutable cache, imported by `vite.config.ts` (`preview.headers`) and mirrored in `public/_headers` and `vercel.json`. `deploy/security-headers.test.ts` checks parity plus `wrangler.jsonc` / `public/_redirects` SPA routing (`not_found_handling: "404-page"` with explicit 200 proxy rules for `/reveal`, `/reveal/`, `/how-it-works`, `/how-it-works/` and `dist/404.html` copied from `dist/index.html` by `bun run build`) and the `vercel.json` rewrite (`/((?!assets/).*)` → `/index.html`).

## Commands

| Command | Purpose |
|---|---|
| `bun run dev` | Start Vite dev server (builds `src/wasm/` first if missing) |
| `bun run wasm` | Compile `crates/steg-core` to `src/wasm/` via `wasm-pack` |
| `bun run build` | `wasm` → `tsc -b` → `vite build` → copy `dist/index.html` to `dist/404.html` → static `dist/` |
| `bun run preview` | Serve `dist/` locally on port 4173 with production headers |
| `bun run test` | Run `cargo test` in `crates/steg-core` and all `bun test` suites (`src/` + `deploy/`) |
| `bun test deploy` | Run only the deploy headers/config parity tests |
| `bun run lint` | Run `oxlint` |
| `bun run icons` | Regenerate favicons, app icons, and `public/site.webmanifest` via `scripts/icons.ts` |
| `bun run og` | Regenerate `public/og-image.png` via `scripts/og.ts` |
| `bun run deploy:cf` | Build and deploy static assets via `wrangler deploy` |
| `cargo run --release --manifest-path crates/steg-core/Cargo.toml --example eval` | Run the encoder evaluation harness (see `crates/steg-core/EVAL.md`) |

## Rules

1. **No logging of user data:** app code (`crates/steg-core`, `src/`) must never log messages, passwords, or image bytes and must not use `console.*` (preserve manual `Debug` on `Hidden`). Local build scripts under `scripts/` may print status lines that contain no user data.
2. **Do not edit static art assets:** never modify `public/hero.webp`, `public/og-art.png`, or `public/samples/*.jpg`.
3. **Password & error semantics:** use passwords verbatim (no trimming or Unicode normalization), except rejecting unpaired UTF-16 surrogates in the client before posting to the worker (`The password contains a broken character. Please retype it.` on hide/reveal; `The message contains a broken character. Please retype it.` on hide); clear password fields after every hide/reveal; on reveal, every failure after the image is decoded returns the single generic error (`No message found, or the password is wrong.`), and the pre-decode input checks (the client-side UTF-16 password check plus Rust `EmptyPassword`, `Unsupported`, and `TooLarge`) are the only exceptions.
4. **Format stability:** any change to framing, KDF, cipher, ECC, block ordering, or decoder requires bumping `VERSION` in `crates/steg-core/src/payload.rs` and updating the spec. Do not add support for legacy format v0.
5. **Security headers stay in sync:** edit headers only in `deploy/security-headers.ts` together with their literal copies in `public/_headers` and `vercel.json`, and verify with `bun test deploy`. Never add inline scripts or third-party origins.
6. **Host-neutral static site:** no server code, no Docker, no nginx.
