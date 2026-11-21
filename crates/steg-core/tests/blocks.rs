mod common;
use common::*;
use image::RgbImage;
use rand_chacha::ChaCha20Rng;
use rand_core::SeedableRng;
use std::collections::HashSet;
use steg_core::blocks::*;
use steg_core::ecc::REDUNDANCY;
use steg_core::image_io::{decode, encode, Format};

#[test]
fn header_order_is_fixed() {
    let a = header_order(48_896);
    let b = header_order(48_896);
    assert_eq!(a, b);
    assert_eq!(a.len(), HEADER_BLOCKS);
    assert_eq!(a.iter().collect::<HashSet<_>>().len(), HEADER_BLOCKS);
    assert!(a.iter().all(|&x| (x as usize) < 48_896));
}

#[test]
fn header_and_body_disjoint() {
    let total = 48_896;
    let h = header_order(total);
    let b = body_order(total, &h, [3; 32]);
    assert_eq!(b.len(), total - HEADER_BLOCKS);
    let all: HashSet<u32> = h.iter().chain(b.iter()).copied().collect();
    assert_eq!(all.len(), total);
    assert!(all.iter().all(|&x| (x as usize) < total));
}

#[test]
fn body_order_depends_on_seed_only() {
    let total = 5_000;
    let h = header_order(total);
    let a = body_order(total, &h, [1; 32]);
    let b = body_order(total, &h, [2; 32]);
    assert_ne!(a, b);
    assert_eq!(a, body_order(total, &h, [1; 32]));
    assert_eq!(h, header_order(total));
}

#[test]
fn shuffle_golden() {
    let mut v: Vec<u32> = (0..10).collect();
    let mut rng = ChaCha20Rng::from_seed([7; 32]);
    shuffle(&mut v, &mut rng);
    assert_eq!(v, vec![6u32, 9, 7, 3, 0, 5, 2, 4, 1, 8]);
}

fn coded_bits(n: usize) -> Vec<u8> {
    let mut s: u64 = 12345;
    (0..n)
        .map(|_| {
            s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            ((s >> 40) & 1) as u8
        })
        .collect()
}

/// Embeds into every block, q92 then q75, and returns the bit error count.
fn errors_after_q75(img: &RgbImage, enc: Encoder) -> (usize, usize) {
    let grid = Grid::from_dims(img.width(), img.height());
    let total = grid.total();
    let order: Vec<u32> = (0..total as u32).collect();
    let n = total / REDUNDANCY;
    let bits = coded_bits(n);
    let mut stego = img.clone();
    embed(&mut stego, &grid, &order, &bits, enc);
    let q92 = encode(&stego, Format::Jpeg).unwrap();
    let d92 = decode(&q92, false).unwrap().rgb;
    let d75 = decode(&jpeg_bytes(&d92, 75), false).unwrap().rgb;
    let got = read_bits(&d75, &grid, &order, n);
    (got.iter().zip(&bits).filter(|(a, b)| a != b).count(), n)
}

#[test]
fn raw_bits_survive_q75() {
    let (e, n) = errors_after_q75(&photo(512, 384), Encoder::Adjusted);
    eprintln!("adjusted photo errors {e}/{n}");
    assert_eq!(e, 0);
}

#[test]
fn python_encoder_errs_on_texture() {
    let img = decode(&sample("street"), false).unwrap().rgb;
    let (e, n) = errors_after_q75(&img, Encoder::Python);
    eprintln!("python street errors {e}/{n}");
    assert!(e as f64 / n as f64 > 0.01);
}

#[test]
fn clipping_compensation() {
    for c in [[255u8; 3], [0u8; 3]] {
        let (e, n) = errors_after_q75(&flat(64, 64, c), Encoder::Adjusted);
        eprintln!("flat {c:?} errors {e}/{n}");
        assert_eq!(e, 0);
    }
}

#[test]
fn clipping_compensation_textured_block_reaches_target() {
    use image::Rgb;

    // 3 identical 8x8 blocks (REDUNDANCY = 3) so we can embed one coded bit.
    let make_textured = |centre_fn: &dyn Fn(u32, u32) -> [u8; 3]| -> RgbImage {
        RgbImage::from_fn(24, 8, |x, y| {
            let dx = x % 8;
            let dy = y % 8;
            if (2..6).contains(&dx) && (2..6).contains(&dy) {
                Rgb(centre_fn(dx, dy))
            } else {
                // Edge pixels: half 0, half 255 (24 each).
                let edge_idx = (dx + dy) % 2;
                Rgb(if edge_idx == 0 { [0; 3] } else { [255; 3] })
            }
        })
    };

    // Case 1: both centre and edge are half 0, half 255 (old single-push missed ±25 and stopped at ±18.75).
    // Case 2: centre is near-white [250; 3] and edge is half 0, half 255 (forces alternating to edge on bit 1).
    let cases: [(&str, RgbImage); 2] = [
        (
            "half-clipped-centre-and-edge",
            make_textured(&|dx, dy| if (dx + dy) % 2 == 0 { [0; 3] } else { [255; 3] }),
        ),
        (
            "near-white-centre-textured-edge",
            make_textured(&|_, _| [250; 3]),
        ),
    ];

    let grid = Grid::from_dims(24, 8);
    let order = [0u32, 1, 2];

    for (name, base) in cases {
        for bit in [0u8, 1u8] {
            let mut img = base.clone();
            embed(&mut img, &grid, &order, &[bit], Encoder::Adjusted);
            let get = |x: u32, y: u32| {
                let p = img.get_pixel(x, y).0;
                [p[0] as f32, p[1] as f32, p[2] as f32]
            };
            let diff = block_diff(&get, 0, 0);
            let sgn = if bit == 1 { 1.0f32 } else { -1.0f32 };
            assert!(
                diff * sgn >= STRENGTH - 0.5,
                "{name} bit={bit}: expected diff*{sgn} >= {}, got {diff}",
                STRENGTH - 0.5
            );
        }
    }
}
