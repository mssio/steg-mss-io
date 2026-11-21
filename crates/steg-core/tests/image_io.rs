mod common;
use common::*;
use image::{
    codecs::{
        jpeg::JpegEncoder,
        png::{PngDecoder, PngEncoder},
    },
    ColorType, ExtendedColorType, ImageDecoder, ImageEncoder,
};
use std::io::Cursor;
use steg_core::error::StegError;
use steg_core::image_io::{decode, decode_rgb, encode, encode_with_alpha, Format};

fn crc32(data: &[u8]) -> u32 {
    let mut c = 0xFFFF_FFFFu32;
    for &b in data {
        c ^= b as u32;
        for _ in 0..8 {
            c = if c & 1 != 0 { 0xEDB8_8320 ^ (c >> 1) } else { c >> 1 };
        }
    }
    !c
}

fn chunk(out: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    let mut body = kind.to_vec();
    body.extend_from_slice(data);
    out.extend_from_slice(&body);
    out.extend_from_slice(&crc32(&body).to_be_bytes());
}

#[test]
fn png_decodes_to_rgb() {
    let mut rgba = Vec::new();
    let px: Vec<u8> = (0..12 * 7).flat_map(|i| [i as u8, 3, 200, 128]).collect();
    PngEncoder::new(&mut rgba)
        .write_image(&px, 12, 7, ExtendedColorType::Rgba8)
        .unwrap();
    let d = decode(&rgba, false).unwrap();
    assert_eq!(d.format, Format::Png);
    assert_eq!(d.rgb.dimensions(), (12, 7));
    assert_eq!(d.alpha.as_deref(), Some([128u8; 12 * 7].as_slice()));

    let d_rgb = decode_rgb(&rgba, false).unwrap();
    assert!(d_rgb.alpha.is_none());

    let mut sixteen = Vec::new();
    let px16: Vec<u8> = (0..9 * 5 * 3).flat_map(|i| ((i * 700) as u16).to_ne_bytes()).collect();
    PngEncoder::new(&mut sixteen)
        .write_image(&px16, 9, 5, ExtendedColorType::Rgb16)
        .unwrap();
    let d = decode(&sixteen, false).unwrap();
    assert_eq!(d.format, Format::Png);
    assert_eq!(d.rgb.dimensions(), (9, 5));
    assert!(d.alpha.is_none());
}

#[test]
fn png_alpha_roundtrip_and_orientation() {
    // 4x2 RGBA PNG with distinct alpha per pixel, plus an eXIf chunk with orientation 6 (Rotate90).
    let (w, h) = (4u32, 2u32);
    let mut raw = Vec::new();
    for y in 0..h {
        for x in 0..w {
            let a = (y * w + x) as u8 * 30;
            raw.extend_from_slice(&[x as u8 * 50, y as u8 * 80, 120, a]);
        }
    }
    let mut png = Vec::new();
    let mut enc = PngEncoder::new(&mut png);
    let mut exif = b"MM\x00\x2A\x00\x00\x00\x08\x00\x01\x01\x12\x00\x03\x00\x00\x00\x01".to_vec();
    exif.extend_from_slice(&6u16.to_be_bytes());
    exif.extend_from_slice(&[0, 0, 0, 0, 0, 0]);
    enc.set_exif_metadata(exif).unwrap();
    enc.write_image(&raw, w, h, ExtendedColorType::Rgba8).unwrap();

    let dec = decode(&png, true).unwrap();
    assert_eq!(dec.rgb.dimensions(), (2, 4));
    // Rotate90 clockwise maps (x, y) in 4x2 -> (1 - y, x) in 2x4.
    let alpha = dec.alpha.as_ref().expect("alpha preserved");
    assert_eq!(alpha.len(), 8);
    for y in 0..h {
        for x in 0..w {
            let nx = (h - 1 - y) as usize;
            let ny = x as usize;
            let expected_a = (y * w + x) as u8 * 30;
            assert_eq!(alpha[ny * (h as usize) + nx], expected_a);
        }
    }

    let out = encode_with_alpha(dec.rgb, dec.alpha, Format::Png).unwrap();
    let decoder = PngDecoder::new(Cursor::new(&out)).unwrap();
    assert_eq!(decoder.color_type(), ColorType::Rgba8);
    assert_eq!(decoder.dimensions(), (2, 4));

    // Opaque PNG still encodes as RGB8.
    let opaque = encode_with_alpha(photo(16, 12), None, Format::Png).unwrap();
    let opaque_dec = PngDecoder::new(Cursor::new(&opaque)).unwrap();
    assert_eq!(opaque_dec.color_type(), ColorType::Rgb8);
}

#[test]
fn grayscale_jpeg_decodes_to_rgb() {
    let luma: Vec<u8> = (0..16 * 16).map(|i| (i % 251) as u8).collect();
    let mut out = Vec::new();
    JpegEncoder::new_with_quality(&mut out, 90)
        .write_image(&luma, 16, 16, ExtendedColorType::L8)
        .unwrap();
    let d = decode(&out, false).unwrap();
    assert_eq!(d.format, Format::Jpeg);
    assert_eq!(d.rgb.dimensions(), (16, 16));
    assert!(d.rgb.pixels().all(|p| p[0] == p[1] && p[1] == p[2]));
}

#[test]
fn rejects_other_formats() {
    for bytes in [
        b"GIF89a\x01\x00\x01\x00\x00\x00\x00;".to_vec(),
        b"RIFF\x1a\x00\x00\x00WEBPVP8 ".to_vec(),
        (0..64u8).map(|i| i.wrapping_mul(37).wrapping_add(11)).collect(),
        vec![],
    ] {
        assert_eq!(decode(&bytes, true).unwrap_err(), StegError::Unsupported);
    }
}

#[test]
fn rejects_over_40mp() {
    let mut png = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    let mut ihdr = Vec::new();
    ihdr.extend_from_slice(&8000u32.to_be_bytes());
    ihdr.extend_from_slice(&5001u32.to_be_bytes());
    ihdr.extend_from_slice(&[8, 2, 0, 0, 0]);
    chunk(&mut png, b"IHDR", &ihdr);
    chunk(&mut png, b"IDAT", &[0x78, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]);
    chunk(&mut png, b"IEND", &[]);
    assert_eq!(decode(&png, false).unwrap_err(), StegError::TooLarge);
}

#[test]
fn exif_orientation_applied() {
    let j = with_exif_orientation(jpeg_bytes(&photo(40, 20), 90), 6);
    assert_eq!(decode(&j, true).unwrap().rgb.dimensions(), (20, 40));
    assert_eq!(decode(&j, false).unwrap().rgb.dimensions(), (40, 20));
}

#[test]
fn encode_matches_format() {
    let img = photo(24, 24);
    let j = encode(&img, Format::Jpeg).unwrap();
    assert_eq!(&j[..2], &[0xFF, 0xD8]);
    assert!(!j.windows(4).any(|w| w == b"Exif"));
    let p = encode(&img, Format::Png).unwrap();
    assert_eq!(&p[..8], &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]);
    assert_eq!(Format::Png.mime(), "image/png");
    assert_eq!(Format::Jpeg.mime(), "image/jpeg");
}

#[test]
fn samples_decode() {
    for n in ["landscape", "still-life", "street"] {
        let d = decode(&sample(n), true).unwrap();
        assert_eq!(d.format, Format::Jpeg);
    }
}
