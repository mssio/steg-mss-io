#![allow(dead_code)]
//! Shared fixture builders for integration tests.

use image::{codecs::jpeg::JpegEncoder, ExtendedColorType, ImageEncoder, Rgb, RgbImage};
use std::io::Cursor;

/// Deterministic textured synthetic photo: gradients + seeded noise + hard edges.
pub fn photo(w: u32, h: u32) -> RgbImage {
    let mut state: u64 = 0x9E37_79B9_7F4A_7C15;
    let mut next = move || {
        state = state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (state >> 33) as u32
    };
    RgbImage::from_fn(w, h, |x, y| {
        let gx = (x * 255 / w.max(1)) as i32;
        let gy = (y * 255 / h.max(1)) as i32;
        let noise = (next() % 41) as i32 - 20;
        let edge = if (x / 13 + y / 17) % 2 == 0 { 40 } else { -40 };
        let c = |base: i32| (base + noise + edge).clamp(0, 255) as u8;
        Rgb([c(gx), c(gy), c((gx + gy) / 2)])
    })
}

pub fn flat(w: u32, h: u32, c: [u8; 3]) -> RgbImage {
    RgbImage::from_pixel(w, h, Rgb(c))
}

pub fn png_bytes(img: &RgbImage) -> Vec<u8> {
    let mut out = Vec::new();
    img.write_to(&mut Cursor::new(&mut out), image::ImageFormat::Png)
        .unwrap();
    out
}

pub fn jpeg_bytes(img: &RgbImage, q: u8) -> Vec<u8> {
    let mut out = Vec::new();
    JpegEncoder::new_with_quality(&mut out, q)
        .write_image(img.as_raw(), img.width(), img.height(), ExtendedColorType::Rgb8)
        .unwrap();
    out
}

/// Inserts a minimal big-endian Exif APP1 segment (single IFD0 entry 0x0112) after SOI.
pub fn with_exif_orientation(jpeg: Vec<u8>, orientation: u16) -> Vec<u8> {
    assert_eq!(&jpeg[..2], &[0xFF, 0xD8]);
    let mut seg: Vec<u8> = vec![0xFF, 0xE1, 0x00, 0x22];
    seg.extend_from_slice(b"Exif\0\0");
    seg.extend_from_slice(b"MM\x00\x2A\x00\x00\x00\x08");
    seg.extend_from_slice(&[0x00, 0x01]); // one entry
    seg.extend_from_slice(&[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01]);
    seg.extend_from_slice(&orientation.to_be_bytes());
    seg.extend_from_slice(&[0x00, 0x00]); // value padding
    seg.extend_from_slice(&[0, 0, 0, 0]); // next IFD
    let mut out = vec![0xFF, 0xD8];
    out.extend(seg);
    out.extend_from_slice(&jpeg[2..]);
    out
}

pub fn sample(name: &str) -> Vec<u8> {
    let p = format!(
        "{}/../../public/samples/{}.jpg",
        env!("CARGO_MANIFEST_DIR"),
        name
    );
    std::fs::read(&p).unwrap_or_else(|e| panic!("read {p}: {e}"))
}
