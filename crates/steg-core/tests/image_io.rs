mod common;
use common::*;
use image::{
    codecs::{jpeg::JpegEncoder, png::PngEncoder},
    ExtendedColorType, ImageEncoder,
};
use steg_core::error::StegError;
use steg_core::image_io::{decode, encode, Format};

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

    let mut sixteen = Vec::new();
    let px16: Vec<u8> = (0..9 * 5 * 3).flat_map(|i| ((i * 700) as u16).to_ne_bytes()).collect();
    PngEncoder::new(&mut sixteen)
        .write_image(&px16, 9, 5, ExtendedColorType::Rgb16)
        .unwrap();
    let d = decode(&sixteen, false).unwrap();
    assert_eq!(d.format, Format::Png);
    assert_eq!(d.rgb.dimensions(), (9, 5));
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
