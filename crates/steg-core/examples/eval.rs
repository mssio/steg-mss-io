//! Encoder evaluation harness (spec 6.6). Run: cargo run --release --example eval
use image::{codecs::jpeg::JpegEncoder, ExtendedColorType, ImageEncoder, Rgb, RgbImage};
use rand_chacha::ChaCha20Rng;
use rand_core::{Rng, SeedableRng};
use steg_core::blocks::*;
use steg_core::ecc::REDUNDANCY;
use steg_core::image_io::decode;
use steg_core::payload::{hide_with, reveal_core};

fn photo(w: u32, h: u32) -> RgbImage {
    let mut state: u64 = 0x9E37_79B9_7F4A_7C15;
    let mut next = move || {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (state >> 33) as u32
    };
    RgbImage::from_fn(w, h, |x, y| {
        let gx = (x * 255 / w.max(1)) as i32;
        let gy = (y * 255 / h.max(1)) as i32;
        let noise = (next() % 41) as i32 - 20;
        let edge = if (x / 13 + y / 17) % 2 == 0 { 40 } else { -40 };
        let c = |b: i32| (b + noise + edge).clamp(0, 255) as u8;
        Rgb([c(gx), c(gy), c((gx + gy) / 2)])
    })
}

fn flat(w: u32, h: u32, c: [u8; 3]) -> RgbImage {
    RgbImage::from_pixel(w, h, Rgb(c))
}

/// Black glyph-like strokes on white.
fn text(w: u32, h: u32) -> RgbImage {
    RgbImage::from_fn(w, h, |x, y| {
        let (cx, cy) = (x % 24, y % 32);
        let stroke = (cx >= 4 && cx < 7 && cy >= 4 && cy < 28)
            || (cy >= 4 && cy < 7 && cx >= 4 && cx < 18)
            || (cy >= 14 && cy < 17 && cx >= 4 && cx < 16)
            || (cx >= 15 && cx < 18 && cy >= 4 && cy < 17);
        if stroke { Rgb([0, 0, 0]) } else { Rgb([255, 255, 255]) }
    })
}

fn jpeg(img: &RgbImage, q: u8) -> Vec<u8> {
    let mut out = Vec::new();
    JpegEncoder::new_with_quality(&mut out, q)
        .write_image(img.as_raw(), img.width(), img.height(), ExtendedColorType::Rgb8)
        .unwrap();
    out
}

fn png(img: &RgbImage) -> Vec<u8> {
    let mut out = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png).unwrap();
    out
}

/// Re-encode `bytes` through the given JPEG qualities in sequence (empty = untouched).
fn recompress(bytes: &[u8], qs: &[u8]) -> Vec<u8> {
    let mut cur = bytes.to_vec();
    for &q in qs {
        let d = decode(&cur, false).unwrap();
        cur = jpeg(&d.rgb, q);
    }
    cur
}

fn psnr(a: &RgbImage, b: &RgbImage) -> f64 {
    let mse: f64 = a.as_raw().iter().zip(b.as_raw()).map(|(&x, &y)| (x as f64 - y as f64).powi(2)).sum::<f64>()
        / a.as_raw().len() as f64;
    if mse == 0.0 { 99.0 } else { 10.0 * (255.0f64 * 255.0 / mse).log10() }
}

fn rand_string(rng: &mut ChaCha20Rng, n: usize) -> String {
    (0..n).map(|_| (b'a' + (rng.next_u32() % 26) as u8) as char).collect()
}

fn main() {
    let trials: usize = std::env::var("TRIALS").ok().and_then(|v| v.parse().ok()).unwrap_or(20);
    let sample = |n: &str| std::fs::read(format!("{}/../../public/samples/{n}.jpg", env!("CARGO_MANIFEST_DIR"))).unwrap();
    // (name, bytes, gated)
    let images: Vec<(&str, Vec<u8>, bool)> = vec![
        ("still-life", sample("still-life"), true),
        ("landscape", sample("landscape"), true),
        ("street", sample("street"), true),
        ("photo 1600x1200", png(&photo(1600, 1200)), true),
        ("flat 1600x1200", png(&flat(1600, 1200, [120, 90, 60])), true),
        ("near-white", png(&flat(1600, 1200, [250; 3])), false),
        ("near-black", png(&flat(1600, 1200, [5; 3])), false),
        ("text", png(&text(1600, 1200)), false),
    ];
    let variants: [(&str, Encoder); 4] = [
        ("Python", Encoder::Python),
        ("Adjusted", Encoder::Adjusted),
        ("Cap 2.0", Encoder::AdjustedCap(2.0)),
        ("Margin 1.2", Encoder::AdjustedMargin(1.2)),
    ];
    let recs: [(&str, &[u8]); 5] =
        [("none", &[]), ("q92", &[92]), ("q85", &[85]), ("q75", &[75]), ("q85>q75", &[85, 75])];

    println!("| image | gate | variant | PSNR dB | blocks >2S % | recompress | raw BER % | reveal ok |");
    println!("|---|---|---|---|---|---|---|---|");
    let mut gate_fail: Vec<(String, String)> = Vec::new();
    for (iname, bytes, gated) in &images {
        let orig = decode(bytes, true).unwrap().rgb;
        let (w, h) = (orig.width(), orig.height());
        let grid = Grid::from_dims(w, h);
        let total = grid.total();
        let order = body_order(total, &header_order(total), [7; 32]);
        let n_coded = (total - HEADER_BLOCKS) / REDUNDANCY;
        let mut brng = ChaCha20Rng::from_seed([9; 32]);
        let bits: Vec<u8> = (0..n_coded).map(|_| (brng.next_u32() & 1) as u8).collect();
        for (vname, enc) in variants {
            // Raw-BER image: random bits in every block.
            let mut stego_full = orig.clone();
            embed(&mut stego_full, &grid, &order, &bits, enc);
            let stego_png = png(&stego_full);
            // Distortion from a realistic hide (500 chars).
            let mut rng = ChaCha20Rng::from_seed([1; 32]);
            let msg = rand_string(&mut rng, 500);
            let hidden = hide_with(bytes, &msg, "eval-password", enc, [3; 16], [4; 12]).unwrap();
            let hid_dec = decode(&hidden.bytes, false).unwrap().rgb;
            let ps = psnr(&orig, &hid_dec);
            // Share of blocks with |offset| > 2S in the full-embedding image: measure
            // by centre-minus-edge change relative to the original.
            let get_o = |x: u32, y: u32| { let p = orig.get_pixel(x, y).0; [p[0] as f32, p[1] as f32, p[2] as f32] };
            let get_s = |x: u32, y: u32| { let p = stego_full.get_pixel(x, y).0; [p[0] as f32, p[1] as f32, p[2] as f32] };
            let used = n_coded * REDUNDANCY;
            let big = order[..used].iter().filter(|&&b| {
                let (bx, by) = (b % grid.bw, b / grid.bw);
                (block_diff(&get_s, bx, by) - block_diff(&get_o, bx, by)).abs() > 2.0 * STRENGTH
            }).count();
            let big_pct = 100.0 * big as f64 / used as f64;
            // End-to-end: hide once per trial, reveal after each recompression.
            let mut oks = vec![0usize; recs.len()];
            let mut erng = ChaCha20Rng::from_seed([2; 32]);
            for _ in 0..trials {
                let m = rand_string(&mut erng, 500);
                let pw = rand_string(&mut erng, 12);
                let mut salt = [0u8; 16];
                let mut nonce = [0u8; 12];
                erng.fill_bytes(&mut salt);
                erng.fill_bytes(&mut nonce);
                let hd = hide_with(bytes, &m, &pw, enc, salt, nonce).unwrap();
                for (ri, (_, qs)) in recs.iter().enumerate() {
                    if qs.is_empty() { continue; }
                    let rc = recompress(&hd.bytes, qs);
                    if reveal_core(&rc, &pw).ok().as_deref() == Some(m.as_str()) { oks[ri] += 1; }
                }
            }
            for (ri, (rname, qs)) in recs.iter().enumerate() {
                let rc = recompress(&stego_png, qs);
                let rgb = decode(&rc, false).unwrap().rgb;
                let got = read_bits(&rgb, &grid, &order, n_coded);
                let errs = got.iter().zip(&bits).filter(|(a, b)| a != b).count();
                let ber = 100.0 * errs as f64 / n_coded as f64;
                let e2e = if qs.is_empty() {
                    "-".to_string()
                } else {
                    if *gated && qs.len() == 1 && oks[ri] != trials {
                        gate_fail.push((iname.to_string(), format!("{vname} {rname}")));
                    }
                    format!("{}/{trials}", oks[ri])
                };
                println!("| {iname} | {} | {vname} | {ps:.2} | {big_pct:.1} | {rname} | {ber:.2} | {e2e} |", if *gated { "yes" } else { "no" });
            }
        }
    }
    println!();
    // Gate summary per variant.
    for (vname, _) in variants {
        let f: Vec<_> = gate_fail.iter().filter(|(_, v)| v.starts_with(vname)).collect();
        println!("GATE {vname}: {}", if f.is_empty() { "PASS".to_string() } else { format!("FAIL {f:?}") });
    }
}
