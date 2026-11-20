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
    let mut px: Vec<f32> = img.as_raw().iter().map(|&v| v as f32).collect();
    embed(&mut px, &grid, img.width(), &order, &bits, enc);
    let raw: Vec<u8> = px.iter().map(|v| v.round().clamp(0.0, 255.0) as u8).collect();
    let stego = RgbImage::from_raw(img.width(), img.height(), raw).unwrap();
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
