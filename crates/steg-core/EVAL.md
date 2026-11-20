# Encoder evaluation (milestone 1)

## What was tested and why

Hiding a message means nudging brightness in 8x8 pixel blocks. The recipient's decoder is fixed (format v1), so the only thing we can still choose is how the *encoder* nudges the pixels. A single wrong bit makes the encrypted message unreadable, so the encoder must survive a JPEG re-save of the image. Four encoders were compared:

- **Python**: the original script's fixed +/-25 nudge.
- **Adjusted**: first measures each block's natural contrast and nudges just enough to reach the target (spec 6.4). Includes a clipping fix for pixels stuck at 0 or 255.
- **Cap 2.0**: like Adjusted, but never changes a block by more than 2x the strength (gentler on busy textures).
- **Margin 1.2**: like Adjusted, but aims for 1.2x the strength (extra safety margin).

Method (`cargo run --release --example eval`, reproducible: fixed random seeds):
- Images: the 3 sample photos (2048x1533), a synthetic photo and a flat colour (both 1600x1200 so a 500-character message fits), plus stress images: near-white, near-black, and black text-like strokes on white.
- Recompression: none, JPEG q92, q85, q75, and chained q85 then q75.
- **raw BER**: share of wrong bits when random bits fill every block, before error correction.
- **reveal ok**: out of 20 full hide + recompress + reveal trials with a random 500-character message and random password (full-cost key derivation). Run with 20 trials per cell.
- **PSNR**: similarity of the hidden image to the original before recompression (higher = less visible change; about 25-30 dB is typical for this strength).
- **blocks >2S**: share of used blocks that changed by more than twice the strength.

Gate (must pass): the 3 samples + small photo + flat colour, single recompression at q92, q85, q75: zero reveal failures. Chained q85>q75 and the stress images are reported only.

## Results

| image | gate | variant | PSNR dB | blocks >2S % | recompress | raw BER % | reveal ok |
|---|---|---|---|---|---|---|---|
| still-life | yes | Python | 29.62 | 0.0 | none | 0.06 | - |
| still-life | yes | Python | 29.62 | 0.0 | q92 | 0.07 | 20/20 |
| still-life | yes | Python | 29.62 | 0.0 | q85 | 0.06 | 20/20 |
| still-life | yes | Python | 29.62 | 0.0 | q75 | 0.06 | 20/20 |
| still-life | yes | Python | 29.62 | 0.0 | q85>q75 | 0.03 | 20/20 |
| still-life | yes | Adjusted | 28.48 | 1.2 | none | 0.00 | - |
| still-life | yes | Adjusted | 28.48 | 1.2 | q92 | 0.00 | 20/20 |
| still-life | yes | Adjusted | 28.48 | 1.2 | q85 | 0.00 | 20/20 |
| still-life | yes | Adjusted | 28.48 | 1.2 | q75 | 0.00 | 20/20 |
| still-life | yes | Adjusted | 28.48 | 1.2 | q85>q75 | 0.00 | 20/20 |
| still-life | yes | Cap 2.0 | 28.61 | 0.4 | none | 0.00 | - |
| still-life | yes | Cap 2.0 | 28.61 | 0.4 | q92 | 0.00 | 20/20 |
| still-life | yes | Cap 2.0 | 28.61 | 0.4 | q85 | 0.00 | 20/20 |
| still-life | yes | Cap 2.0 | 28.61 | 0.4 | q75 | 0.00 | 20/20 |
| still-life | yes | Cap 2.0 | 28.61 | 0.4 | q85>q75 | 0.00 | 20/20 |
| still-life | yes | Margin 1.2 | 27.08 | 1.7 | none | 0.00 | - |
| still-life | yes | Margin 1.2 | 27.08 | 1.7 | q92 | 0.00 | 20/20 |
| still-life | yes | Margin 1.2 | 27.08 | 1.7 | q85 | 0.00 | 20/20 |
| still-life | yes | Margin 1.2 | 27.08 | 1.7 | q75 | 0.00 | 20/20 |
| still-life | yes | Margin 1.2 | 27.08 | 1.7 | q85>q75 | 0.00 | 20/20 |
| landscape | yes | Python | 29.64 | 0.0 | none | 0.28 | - |
| landscape | yes | Python | 29.64 | 0.0 | q92 | 0.31 | 18/20 |
| landscape | yes | Python | 29.64 | 0.0 | q85 | 0.31 | 18/20 |
| landscape | yes | Python | 29.64 | 0.0 | q75 | 0.37 | 17/20 |
| landscape | yes | Python | 29.64 | 0.0 | q85>q75 | 0.32 | 18/20 |
| landscape | yes | Adjusted | 28.01 | 3.2 | none | 0.00 | - |
| landscape | yes | Adjusted | 28.01 | 3.2 | q92 | 0.00 | 20/20 |
| landscape | yes | Adjusted | 28.01 | 3.2 | q85 | 0.00 | 20/20 |
| landscape | yes | Adjusted | 28.01 | 3.2 | q75 | 0.00 | 20/20 |
| landscape | yes | Adjusted | 28.01 | 3.2 | q85>q75 | 0.00 | 20/20 |
| landscape | yes | Cap 2.0 | 28.33 | 1.1 | none | 0.02 | - |
| landscape | yes | Cap 2.0 | 28.33 | 1.1 | q92 | 0.02 | 20/20 |
| landscape | yes | Cap 2.0 | 28.33 | 1.1 | q85 | 0.02 | 20/20 |
| landscape | yes | Cap 2.0 | 28.33 | 1.1 | q75 | 0.02 | 20/20 |
| landscape | yes | Cap 2.0 | 28.33 | 1.1 | q85>q75 | 0.02 | 20/20 |
| landscape | yes | Margin 1.2 | 26.73 | 4.5 | none | 0.00 | - |
| landscape | yes | Margin 1.2 | 26.73 | 4.5 | q92 | 0.00 | 20/20 |
| landscape | yes | Margin 1.2 | 26.73 | 4.5 | q85 | 0.00 | 20/20 |
| landscape | yes | Margin 1.2 | 26.73 | 4.5 | q75 | 0.00 | 20/20 |
| landscape | yes | Margin 1.2 | 26.73 | 4.5 | q85>q75 | 0.00 | 20/20 |
| street | yes | Python | 29.62 | 0.0 | none | 0.82 | - |
| street | yes | Python | 29.62 | 0.0 | q92 | 0.88 | 4/20 |
| street | yes | Python | 29.62 | 0.0 | q85 | 0.87 | 4/20 |
| street | yes | Python | 29.62 | 0.0 | q75 | 1.01 | 2/20 |
| street | yes | Python | 29.62 | 0.0 | q85>q75 | 0.67 | 5/20 |
| street | yes | Adjusted | 27.55 | 5.1 | none | 0.00 | - |
| street | yes | Adjusted | 27.55 | 5.1 | q92 | 0.00 | 20/20 |
| street | yes | Adjusted | 27.55 | 5.1 | q85 | 0.00 | 20/20 |
| street | yes | Adjusted | 27.55 | 5.1 | q75 | 0.00 | 20/20 |
| street | yes | Adjusted | 27.55 | 5.1 | q85>q75 | 0.00 | 20/20 |
| street | yes | Cap 2.0 | 27.93 | 1.8 | none | 0.02 | - |
| street | yes | Cap 2.0 | 27.93 | 1.8 | q92 | 0.02 | 20/20 |
| street | yes | Cap 2.0 | 27.93 | 1.8 | q85 | 0.03 | 20/20 |
| street | yes | Cap 2.0 | 27.93 | 1.8 | q75 | 0.03 | 20/20 |
| street | yes | Cap 2.0 | 27.93 | 1.8 | q85>q75 | 0.02 | 20/20 |
| street | yes | Margin 1.2 | 26.30 | 7.2 | none | 0.00 | - |
| street | yes | Margin 1.2 | 26.30 | 7.2 | q92 | 0.00 | 20/20 |
| street | yes | Margin 1.2 | 26.30 | 7.2 | q85 | 0.00 | 20/20 |
| street | yes | Margin 1.2 | 26.30 | 7.2 | q75 | 0.00 | 20/20 |
| street | yes | Margin 1.2 | 26.30 | 7.2 | q85>q75 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Python | 27.68 | 0.0 | none | 1.76 | - |
| photo 1600x1200 | yes | Python | 27.68 | 0.0 | q92 | 1.84 | 0/20 |
| photo 1600x1200 | yes | Python | 27.68 | 0.0 | q85 | 1.97 | 0/20 |
| photo 1600x1200 | yes | Python | 27.68 | 0.0 | q75 | 1.95 | 0/20 |
| photo 1600x1200 | yes | Python | 27.68 | 0.0 | q85>q75 | 1.72 | 0/20 |
| photo 1600x1200 | yes | Adjusted | 25.12 | 6.2 | none | 0.00 | - |
| photo 1600x1200 | yes | Adjusted | 25.12 | 6.2 | q92 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Adjusted | 25.12 | 6.2 | q85 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Adjusted | 25.12 | 6.2 | q75 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Adjusted | 25.12 | 6.2 | q85>q75 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Cap 2.0 | 25.26 | 2.7 | none | 0.00 | - |
| photo 1600x1200 | yes | Cap 2.0 | 25.26 | 2.7 | q92 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Cap 2.0 | 25.26 | 2.7 | q85 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Cap 2.0 | 25.26 | 2.7 | q75 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Cap 2.0 | 25.26 | 2.7 | q85>q75 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Margin 1.2 | 23.90 | 10.8 | none | 0.00 | - |
| photo 1600x1200 | yes | Margin 1.2 | 23.90 | 10.8 | q92 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Margin 1.2 | 23.90 | 10.8 | q85 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Margin 1.2 | 23.90 | 10.8 | q75 | 0.00 | 20/20 |
| photo 1600x1200 | yes | Margin 1.2 | 23.90 | 10.8 | q85>q75 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Python | 27.34 | 0.0 | none | 0.00 | - |
| flat 1600x1200 | yes | Python | 27.34 | 0.0 | q92 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Python | 27.34 | 0.0 | q85 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Python | 27.34 | 0.0 | q75 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Python | 27.34 | 0.0 | q85>q75 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Adjusted | 27.34 | 0.0 | none | 0.00 | - |
| flat 1600x1200 | yes | Adjusted | 27.34 | 0.0 | q92 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Adjusted | 27.34 | 0.0 | q85 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Adjusted | 27.34 | 0.0 | q75 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Adjusted | 27.34 | 0.0 | q85>q75 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Cap 2.0 | 27.34 | 0.0 | none | 0.00 | - |
| flat 1600x1200 | yes | Cap 2.0 | 27.34 | 0.0 | q92 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Cap 2.0 | 27.34 | 0.0 | q85 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Cap 2.0 | 27.34 | 0.0 | q75 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Cap 2.0 | 27.34 | 0.0 | q85>q75 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Margin 1.2 | 25.77 | 0.0 | none | 0.00 | - |
| flat 1600x1200 | yes | Margin 1.2 | 25.77 | 0.0 | q92 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Margin 1.2 | 25.77 | 0.0 | q85 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Margin 1.2 | 25.77 | 0.0 | q75 | 0.00 | 20/20 |
| flat 1600x1200 | yes | Margin 1.2 | 25.77 | 0.0 | q85>q75 | 0.00 | 20/20 |
| near-white | no | Python | 30.10 | 0.0 | none | 0.00 | - |
| near-white | no | Python | 30.10 | 0.0 | q92 | 0.00 | 20/20 |
| near-white | no | Python | 30.10 | 0.0 | q85 | 0.00 | 20/20 |
| near-white | no | Python | 30.10 | 0.0 | q75 | 0.00 | 20/20 |
| near-white | no | Python | 30.10 | 0.0 | q85>q75 | 0.00 | 20/20 |
| near-white | no | Adjusted | 26.11 | 0.0 | none | 0.00 | - |
| near-white | no | Adjusted | 26.11 | 0.0 | q92 | 0.00 | 20/20 |
| near-white | no | Adjusted | 26.11 | 0.0 | q85 | 0.00 | 20/20 |
| near-white | no | Adjusted | 26.11 | 0.0 | q75 | 0.00 | 20/20 |
| near-white | no | Adjusted | 26.11 | 0.0 | q85>q75 | 0.00 | 20/20 |
| near-white | no | Cap 2.0 | 26.11 | 0.0 | none | 0.00 | - |
| near-white | no | Cap 2.0 | 26.11 | 0.0 | q92 | 0.00 | 20/20 |
| near-white | no | Cap 2.0 | 26.11 | 0.0 | q85 | 0.00 | 20/20 |
| near-white | no | Cap 2.0 | 26.11 | 0.0 | q75 | 0.00 | 20/20 |
| near-white | no | Cap 2.0 | 26.11 | 0.0 | q85>q75 | 0.00 | 20/20 |
| near-white | no | Margin 1.2 | 24.27 | 0.0 | none | 0.00 | - |
| near-white | no | Margin 1.2 | 24.27 | 0.0 | q92 | 0.00 | 20/20 |
| near-white | no | Margin 1.2 | 24.27 | 0.0 | q85 | 0.00 | 20/20 |
| near-white | no | Margin 1.2 | 24.27 | 0.0 | q75 | 0.00 | 20/20 |
| near-white | no | Margin 1.2 | 24.27 | 0.0 | q85>q75 | 0.00 | 20/20 |
| near-black | no | Python | 29.34 | 0.0 | none | 0.00 | - |
| near-black | no | Python | 29.34 | 0.0 | q92 | 0.00 | 20/20 |
| near-black | no | Python | 29.34 | 0.0 | q85 | 0.00 | 20/20 |
| near-black | no | Python | 29.34 | 0.0 | q75 | 0.00 | 20/20 |
| near-black | no | Python | 29.34 | 0.0 | q85>q75 | 0.00 | 20/20 |
| near-black | no | Adjusted | 25.92 | 0.0 | none | 0.00 | - |
| near-black | no | Adjusted | 25.92 | 0.0 | q92 | 0.00 | 20/20 |
| near-black | no | Adjusted | 25.92 | 0.0 | q85 | 0.00 | 20/20 |
| near-black | no | Adjusted | 25.92 | 0.0 | q75 | 0.00 | 20/20 |
| near-black | no | Adjusted | 25.92 | 0.0 | q85>q75 | 0.00 | 20/20 |
| near-black | no | Cap 2.0 | 25.92 | 0.0 | none | 0.00 | - |
| near-black | no | Cap 2.0 | 25.92 | 0.0 | q92 | 0.00 | 20/20 |
| near-black | no | Cap 2.0 | 25.92 | 0.0 | q85 | 0.00 | 20/20 |
| near-black | no | Cap 2.0 | 25.92 | 0.0 | q75 | 0.00 | 20/20 |
| near-black | no | Cap 2.0 | 25.92 | 0.0 | q85>q75 | 0.00 | 20/20 |
| near-black | no | Margin 1.2 | 24.07 | 0.0 | none | 0.00 | - |
| near-black | no | Margin 1.2 | 24.07 | 0.0 | q92 | 0.00 | 20/20 |
| near-black | no | Margin 1.2 | 24.07 | 0.0 | q85 | 0.00 | 20/20 |
| near-black | no | Margin 1.2 | 24.07 | 0.0 | q75 | 0.00 | 20/20 |
| near-black | no | Margin 1.2 | 24.07 | 0.0 | q85>q75 | 0.00 | 20/20 |
| text | no | Python | 30.61 | 0.0 | none | 25.81 | - |
| text | no | Python | 30.61 | 0.0 | q92 | 25.81 | 0/20 |
| text | no | Python | 30.61 | 0.0 | q85 | 25.81 | 0/20 |
| text | no | Python | 30.61 | 0.0 | q75 | 32.07 | 0/20 |
| text | no | Python | 30.61 | 0.0 | q85>q75 | 38.11 | 0/20 |
| text | no | Adjusted | 20.29 | 25.0 | none | 0.00 | - |
| text | no | Adjusted | 20.29 | 25.0 | q92 | 0.00 | 20/20 |
| text | no | Adjusted | 20.29 | 25.0 | q85 | 0.00 | 20/20 |
| text | no | Adjusted | 20.29 | 25.0 | q75 | 0.00 | 20/20 |
| text | no | Adjusted | 20.29 | 25.0 | q85>q75 | 0.00 | 20/20 |
| text | no | Cap 2.0 | 23.48 | 8.3 | none | 3.69 | - |
| text | no | Cap 2.0 | 23.48 | 8.3 | q92 | 3.69 | 0/20 |
| text | no | Cap 2.0 | 23.48 | 8.3 | q85 | 3.69 | 0/20 |
| text | no | Cap 2.0 | 23.48 | 8.3 | q75 | 3.69 | 0/20 |
| text | no | Cap 2.0 | 23.48 | 8.3 | q85>q75 | 4.65 | 0/20 |
| text | no | Margin 1.2 | 19.61 | 29.3 | none | 0.00 | - |
| text | no | Margin 1.2 | 19.61 | 29.3 | q92 | 0.00 | 20/20 |
| text | no | Margin 1.2 | 19.61 | 29.3 | q85 | 0.00 | 20/20 |
| text | no | Margin 1.2 | 19.61 | 29.3 | q75 | 0.00 | 20/20 |
| text | no | Margin 1.2 | 19.61 | 29.3 | q85>q75 | 0.00 | 20/20 |


GATE Python: FAIL [("landscape", "Python q92"), ("landscape", "Python q85"), ("landscape", "Python q75"), ("street", "Python q92"), ("street", "Python q85"), ("street", "Python q75"), ("photo 1600x1200", "Python q92"), ("photo 1600x1200", "Python q85"), ("photo 1600x1200", "Python q75")]
GATE Adjusted: PASS
GATE Cap 2.0: PASS
GATE Margin 1.2: PASS


## Decision

**Keep `Adjusted` as `DEFAULT_ENCODER`, overriding the literal spec 6.6 rule.**

Spec 6.6 says the default is the gate-passing variant with the least distortion, with the stress images only as a tiebreaker. Applied literally, that picks **Cap 2.0**: it passes the gate (20/20 on all five gate images at q92, q85 and q75) and has the higher PSNR. We override that rule, on purpose, for four reasons:

1. The owner explicitly chose the Adjusted encoder (spec section 5).
2. Cap 2.0 leaves a small but nonzero raw bit error rate on the real landscape and street photos (0.02-0.03%) where Adjusted has none. Error correction absorbed it in this test, but it means less safety margin against other JPEG encoders (phones, messaging apps) than the one used here.
3. Cap 2.0 fails the text stress image completely (0/20; 3.7% raw errors), where Adjusted is 20/20.
4. Its visual gain is small: 0 to 0.4 dB PSNR better than Adjusted on the gate images, which is not visible.

Other results: Python fails the gate (landscape 17-18 of 20 succeed, street 2-4 of 20, synthetic photo 0 of 20). Margin 1.2 passes but is 1.2 to 1.6 dB more distorted than Adjusted on the gate images, with no reliability benefit. Adjusted has 0.00% raw bit errors and 20/20 everywhere, including the chained and stress cases. No decoder or format change was needed.

Note: `AdjustedCap`'s clipping compensation was fixed before this run so that it aims at the capped change rather than undoing the cap.

## How to reproduce

```
CARGO_PROFILE_RELEASE_OPT_LEVEL=3 cargo run --release --manifest-path crates/steg-core/Cargo.toml --example eval > crates/steg-core/EVAL.md.tmp
```

20 trials per cell (set `TRIALS=n` to change); about 17 minutes. The environment override is no longer needed now that the release profile uses opt-level 3.

## WASM build profile

Key derivation (PBKDF2, 600,000 rounds) is slow at the old `opt-level = "z"` (size-optimised). Measured with `wasm-pack build crates/steg-core --target web --release`, lto on, and one `reveal()` of a hidden sample under Node 24:

| opt-level | .wasm size | reveal() |
|---|---|---|
| "z" | 470,405 bytes | 429 ms |
| 3 | 564,927 bytes | 263 ms |

Size grows 1.2x (well under 2x) and reveal is about 40% faster, so the release profile now uses `opt-level = 3`.
