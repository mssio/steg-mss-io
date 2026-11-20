mod common;
use common::*;
use std::time::Instant;
use steg_core::error::StegError;
use steg_core::image_io::decode;
use steg_core::payload::*;

const PW: &str = "correct horse";

fn hide_reveal_png(msg: &str) {
    let out = hide_core(&png_bytes(&photo(640, 480)), msg, PW).unwrap();
    assert_eq!(out.mime, "image/png");
    assert_eq!(reveal_core(&out.bytes, PW).unwrap(), msg);
}

#[test]
fn roundtrip_png_photo() {
    hide_reveal_png("hello world");
}

#[test]
fn roundtrip_jpeg_photo() {
    let out = hide_core(&jpeg_bytes(&photo(640, 480), 90), "hello jpeg", PW).unwrap();
    assert_eq!(out.mime, "image/jpeg");
    assert!(out.blocks_used > 714 && out.blocks_used <= out.blocks_total);
    assert_eq!(reveal_core(&out.bytes, PW).unwrap(), "hello jpeg");
}

#[test]
fn roundtrip_flat_png() {
    let out = hide_core(&png_bytes(&flat(1600, 1200, [120, 90, 60])), "flat png", PW).unwrap();
    assert_eq!(reveal_core(&out.bytes, PW).unwrap(), "flat png");
}

#[test]
fn roundtrip_flat_jpeg() {
    let out = hide_core(&jpeg_bytes(&flat(1600, 1200, [120, 90, 60]), 90), "flat jpeg", PW).unwrap();
    assert_eq!(reveal_core(&out.bytes, PW).unwrap(), "flat jpeg");
}

#[test]
fn survives_recompression() {
    let msg = "survive the squeeze";
    let out = hide_core(&jpeg_bytes(&photo(640, 480), 92), msg, PW).unwrap();
    let img = decode(&out.bytes, false).unwrap().rgb;
    for q in [75u8, 85] {
        assert_eq!(reveal_core(&jpeg_bytes(&img, q), PW).unwrap(), msg, "q{q}");
    }
}

#[test]
fn wrong_password_is_generic() {
    let out = hide_core(&png_bytes(&photo(640, 480)), "secret", PW).unwrap();
    let e = reveal_core(&out.bytes, "wrong").unwrap_err();
    assert_eq!(e.to_string(), "No message found, or the password is wrong.");
}

#[test]
fn untouched_photo_is_generic() {
    assert_eq!(reveal_core(&sample("street"), PW).unwrap_err(), StegError::NotFound);
}

#[test]
fn multibyte_roundtrip() {
    hide_reveal_png("秘密のメッセージ 🔐👀 привет");
}

#[test]
fn byte_cap_enforced() {
    // find dims with 50 <= M < 100
    let (w, h) = (640u32, 480u32);
    let total = ((w / 8) * (h / 8)) as usize;
    let m = max_message_bytes(total);
    assert!((50..100).contains(&m), "M={m}");
    let img = png_bytes(&photo(w, h));
    let ok = "a".repeat(m as usize);
    let out = hide_core(&img, &ok, PW).unwrap();
    assert_eq!(reveal_core(&out.bytes, PW).unwrap(), ok);
    let emoji = "😀".repeat(26);
    assert!(emoji.len() as i64 > m);
    assert_eq!(hide_core(&img, &emoji, PW).unwrap_err(), StegError::TooLong(m as u32));
    assert_eq!(hide_core(&img, &"a".repeat(m as usize + 1), PW).unwrap_err(), StegError::TooLong(m as u32));
}

#[test]
fn char_limit_500() {
    let img = png_bytes(&photo(1600, 1200));
    assert_eq!(hide_core(&img, &"a".repeat(501), PW).unwrap_err(), StegError::TooLong(500));
    let out = hide_core(&img, &"a".repeat(500), PW).unwrap();
    assert_eq!(reveal_core(&out.bytes, PW).unwrap().len(), 500);
}

#[test]
fn too_small() {
    let e = hide_core(&png_bytes(&flat(64, 64, [1, 2, 3])), "x", PW).unwrap_err();
    assert_eq!(e.to_string(), "This image is too small to hold a message.");
    assert_eq!(capacity_core(&png_bytes(&flat(64, 64, [1, 2, 3]))).unwrap_err(), StegError::TooSmall);
}

#[test]
fn empty_inputs() {
    let img = png_bytes(&photo(640, 480));
    assert_eq!(hide_core(&img, "x", "").unwrap_err(), StegError::EmptyPassword);
    assert_eq!(hide_core(&img, "", "p").unwrap_err(), StegError::EmptyMessage);
}

#[test]
fn exif_rotated_jpeg() {
    let j = with_exif_orientation(jpeg_bytes(&photo(640, 480), 90), 6);
    let out = hide_core(&j, "rotated", PW).unwrap();
    let d = decode(&out.bytes, false).unwrap().rgb;
    assert_eq!((d.width(), d.height()), (480, 640));
    assert_eq!(reveal_core(&out.bytes, PW).unwrap(), "rotated");
}

#[test]
fn odd_dimensions() {
    let src = photo(1003, 757);
    let out = hide_core(&png_bytes(&src), "odd", PW).unwrap();
    let d = decode(&out.bytes, false).unwrap().rgb;
    assert_eq!(reveal_core(&out.bytes, PW).unwrap(), "odd");
    for y in 0..757 {
        for x in 1000..1003 {
            assert_eq!(d.get_pixel(x, y), src.get_pixel(x, y));
        }
    }
    for y in 752..757 {
        for x in 0..1003 {
            assert_eq!(d.get_pixel(x, y), src.get_pixel(x, y));
        }
    }
}

#[test]
fn password_exactness() {
    let img = png_bytes(&photo(640, 480));
    let out = hide_core(&img, "m", "pässwörd ✓").unwrap();
    assert_eq!(reveal_core(&out.bytes, "pässwörd ✓").unwrap(), "m");
    let out = hide_core(&img, "m", "pass").unwrap();
    assert_eq!(reveal_core(&out.bytes, "pass").unwrap(), "m");
    assert!(reveal_core(&out.bytes, " pass").is_err());
}

#[test]
fn capacity_no_kdf() {
    let s = sample("street");
    let d = decode(&s, true).unwrap().rgb;
    let total = ((d.width() / 8) * (d.height() / 8)) as usize;
    let m = max_message_bytes(total);
    let t = Instant::now();
    let c = capacity_core(&s).unwrap();
    assert!(t.elapsed().as_millis() < 200);
    assert_eq!(c as i64, m.min(500));
}

#[test]
fn unsupported_and_corrupt() {
    assert_eq!(reveal_core(b"GIF89a....", PW).unwrap_err(), StegError::Unsupported);
    let mut p = png_bytes(&photo(64, 64));
    p.truncate(40);
    assert_eq!(reveal_core(&p, PW).unwrap_err(), StegError::NotFound);
}

#[test]
fn deterministic_with_fixed_salt() {
    let img = png_bytes(&photo(640, 480));
    let a = hide_with(&img, "x", PW, steg_core::blocks::DEFAULT_ENCODER, [7; 16], [9; 12]).unwrap();
    let b = hide_with(&img, "x", PW, steg_core::blocks::DEFAULT_ENCODER, [7; 16], [9; 12]).unwrap();
    assert_eq!(a.bytes, b.bytes);
}

#[test]
fn diff_preview_is_png() {
    let img = png_bytes(&photo(640, 480));
    let out = hide_core(&img, "diff", PW).unwrap();
    let p = diff_preview_core(&img, &out.bytes).unwrap();
    let d = decode(&p, false).unwrap();
    assert_eq!(d.format, steg_core::image_io::Format::Png);
    assert_eq!((d.rgb.width(), d.rgb.height()), (640, 480));
    assert!(d.rgb.as_raw().iter().any(|&v| v > 0));
    let other = png_bytes(&photo(100, 100));
    assert_eq!(diff_preview_core(&img, &other).unwrap_err(), StegError::NotFound);
}
