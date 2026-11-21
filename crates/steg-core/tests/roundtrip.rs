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
fn roundtrip_rgba_png_preserves_alpha() {
    use image::{
        codecs::png::{PngDecoder, PngEncoder},
        ColorType, ExtendedColorType, ImageDecoder, ImageEncoder,
    };
    use std::io::Cursor;

    let base = photo(640, 480);
    let (w, h) = base.dimensions();
    let mut raw = Vec::with_capacity((w * h * 4) as usize);
    let mut expected_alpha = Vec::with_capacity((w * h) as usize);
    for (y, row) in base.rows().enumerate() {
        for (x, px) in row.enumerate() {
            // Mix fully transparent (0), partially transparent (64, 180), and opaque (255).
            let a = match (x / 160, y / 240) {
                (0, _) => 0u8,
                (1, _) => 64u8,
                (2, _) => 180u8,
                _ => 255u8,
            };
            raw.extend_from_slice(&px.0);
            raw.push(a);
            expected_alpha.push(a);
        }
    }
    let mut input_png = Vec::new();
    PngEncoder::new(&mut input_png)
        .write_image(&raw, w, h, ExtendedColorType::Rgba8)
        .unwrap();

    let out = hide_core(&input_png, "transparent secret", PW).unwrap();
    assert_eq!(out.mime, "image/png");

    let png_dec = PngDecoder::new(Cursor::new(&out.bytes)).unwrap();
    assert_eq!(png_dec.color_type(), ColorType::Rgba8);

    let dec = decode(&out.bytes, false).unwrap();
    assert_eq!(dec.alpha.as_deref(), Some(expected_alpha.as_slice()));
    assert_eq!(reveal_core(&out.bytes, PW).unwrap(), "transparent secret");

    // diff_preview must remain opaque RGB8.
    let diff = diff_preview_core(&input_png, &out.bytes).unwrap();
    let diff_dec = PngDecoder::new(Cursor::new(&diff)).unwrap();
    assert_eq!(diff_dec.color_type(), ColorType::Rgb8);
}

#[test]
fn roundtrip_preserves_icc_profile_png_and_jpeg() {
    use image::{
        codecs::{
            jpeg::{JpegDecoder, JpegEncoder},
            png::{PngDecoder, PngEncoder},
        },
        ExtendedColorType, ImageDecoder, ImageEncoder,
    };
    use std::io::Cursor;

    let dummy_icc: Vec<u8> = b"DUMMY-DISPLAY-P3-ICC-PROFILE-0123456789abcdef".to_vec();
    let img = photo(640, 480);
    let (w, h) = img.dimensions();

    // PNG with ICC profile.
    let mut png_in = Vec::new();
    let mut png_enc = PngEncoder::new(&mut png_in);
    png_enc.set_icc_profile(dummy_icc.clone()).unwrap();
    png_enc
        .write_image(img.as_raw(), w, h, ExtendedColorType::Rgb8)
        .unwrap();

    let png_out = hide_core(&png_in, "icc png secret", PW).unwrap();
    let mut png_dec = PngDecoder::new(Cursor::new(&png_out.bytes)).unwrap();
    assert_eq!(png_dec.icc_profile().unwrap().as_deref(), Some(dummy_icc.as_slice()));
    assert_eq!(reveal_core(&png_out.bytes, PW).unwrap(), "icc png secret");

    // JPEG with ICC profile.
    let mut jpg_in = Vec::new();
    let mut jpg_enc = JpegEncoder::new_with_quality(&mut jpg_in, 90);
    jpg_enc.set_icc_profile(dummy_icc.clone()).unwrap();
    jpg_enc
        .write_image(img.as_raw(), w, h, ExtendedColorType::Rgb8)
        .unwrap();

    let jpg_out = hide_core(&jpg_in, "icc jpeg secret", PW).unwrap();
    let mut jpg_dec = JpegDecoder::new(Cursor::new(&jpg_out.bytes)).unwrap();
    assert_eq!(jpg_dec.icc_profile().unwrap().as_deref(), Some(dummy_icc.as_slice()));
    assert_eq!(reveal_core(&jpg_out.bytes, PW).unwrap(), "icc jpeg secret");

    // diff_preview does not carry an ICC profile.
    let diff = diff_preview_core(&png_in, &png_out.bytes).unwrap();
    let mut diff_dec = PngDecoder::new(Cursor::new(&diff)).unwrap();
    assert!(diff_dec.icc_profile().unwrap().is_none());
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
    assert!(emoji.chars().count() <= m as usize);
    assert!(emoji.len() as i64 > m);
    assert_eq!(hide_core(&img, &emoji, PW).unwrap_err(), StegError::TooLongBytes(m as u32));
    assert_eq!(hide_core(&img, &"a".repeat(m as usize + 1), PW).unwrap_err(), StegError::TooLong(m as u32));
}

#[test]
fn char_limit_500() {
    let img = png_bytes(&photo(1600, 1200));
    let m = max_message_bytes(((1600 / 8) * (1200 / 8)) as usize);
    assert!(m > 500, "M={m}");
    assert_eq!(hide_core(&img, &"a".repeat(501), PW).unwrap_err(), StegError::TooLong(500));
    // Under 500 code points, but UTF-8 byte length exceeds M -> TooLongBytes(M).
    let emoji = "😀".repeat((m as usize / 4) + 1);
    assert!(emoji.chars().count() <= 500);
    assert!(emoji.len() as i64 > m);
    assert_eq!(hide_core(&img, &emoji, PW).unwrap_err(), StegError::TooLongBytes(m as u32));
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
    assert_eq!(reveal_core(&img, "").unwrap_err(), StegError::EmptyPassword);
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
fn capacity_header_only_matches_full_decode_and_hide() {
    let cases = [
        ("png", png_bytes(&photo(640, 480))),
        ("jpeg", jpeg_bytes(&photo(640, 480), 90)),
        ("exif_rot90", with_exif_orientation(jpeg_bytes(&photo(640, 480), 90), 6)),
        ("exif_rot270", with_exif_orientation(jpeg_bytes(&photo(640, 480), 90), 8)),
    ];
    for (name, bytes) in cases {
        let decoded = decode(&bytes, true).unwrap().rgb;
        let expected_m = max_message_bytes(((decoded.width() / 8) * (decoded.height() / 8)) as usize);
        let detail = capacity_detail_core(&bytes).unwrap();
        assert_eq!(detail.bytes as i64, expected_m, "{name}");
        assert_eq!(detail.chars as i64, expected_m.min(500), "{name}");

        let msg = "a".repeat(detail.chars as usize);
        let hidden = hide_core(&bytes, &msg, PW).unwrap();
        assert_eq!(reveal_core(&hidden.bytes, PW).unwrap(), msg, "{name}");
    }
}

#[test]
fn unsupported_and_corrupt() {
    assert_eq!(reveal_core(b"GIF89a....", PW).unwrap_err(), StegError::Unsupported);
    assert_eq!(capacity_core(b"GIF89a....").unwrap_err(), StegError::Unsupported);

    // Truncated PNG header (fails before IHDR finishes).
    let mut p_hdr = png_bytes(&photo(640, 480));
    p_hdr.truncate(20);
    assert_eq!(capacity_core(&p_hdr).unwrap_err(), StegError::Unreadable);
    assert_eq!(hide_core(&p_hdr, "hello", PW).unwrap_err(), StegError::Unreadable);
    assert_eq!(diff_preview_core(&p_hdr, &p_hdr).unwrap_err(), StegError::Unreadable);
    assert_eq!(reveal_core(&p_hdr, PW).unwrap_err(), StegError::NotFound);

    // Truncated PNG (valid IHDR header, broken IDAT pixel data).
    // Header-only capacity does not decode pixels; pixel-decoding ops still report Unreadable/NotFound.
    let mut p = png_bytes(&photo(640, 480));
    p.truncate(p.len() / 2);
    assert!(capacity_core(&p).is_ok());
    assert_eq!(hide_core(&p, "hello", PW).unwrap_err(), StegError::Unreadable);
    assert_eq!(diff_preview_core(&p, &p).unwrap_err(), StegError::Unreadable);
    assert_eq!(reveal_core(&p, PW).unwrap_err(), StegError::NotFound);

    // Truncated JPEG (valid JPEG magic bytes, truncated mid-header/stream).
    let mut j = jpeg_bytes(&photo(640, 480), 90);
    j.truncate(40);
    assert_eq!(capacity_core(&j).unwrap_err(), StegError::Unreadable);
    assert_eq!(hide_core(&j, "hello", PW).unwrap_err(), StegError::Unreadable);
    assert_eq!(diff_preview_core(&j, &j).unwrap_err(), StegError::Unreadable);
    assert_eq!(reveal_core(&j, PW).unwrap_err(), StegError::NotFound);

    // Corrupt JPEG with valid header/SOF but damaged scan/marker bytes (fails header/pixel parse).
    let mut j_bad = jpeg_bytes(&photo(640, 480), 90);
    let sos = j_bad
        .windows(2)
        .position(|w| w == [0xFF, 0xDA])
        .expect("JPEG has SOS marker");
    j_bad.truncate(sos + 4);
    assert_eq!(capacity_core(&j_bad).unwrap_err(), StegError::Unreadable);
    assert_eq!(hide_core(&j_bad, "hello", PW).unwrap_err(), StegError::Unreadable);
    assert_eq!(diff_preview_core(&j_bad, &j_bad).unwrap_err(), StegError::Unreadable);
    assert_eq!(reveal_core(&j_bad, PW).unwrap_err(), StegError::NotFound);
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
    assert_eq!(diff_preview_core(&img, &other).unwrap_err(), StegError::Internal);
}

#[test]
fn diff_preview_dimension_mismatch_is_internal() {
    let a = png_bytes(&photo(64, 48));
    let b = png_bytes(&photo(48, 64));
    assert_eq!(diff_preview_core(&a, &b).unwrap_err(), StegError::Internal);
}

#[test]
fn capacity_detail_matches_capacity_and_max_message_bytes() {
    let s = sample("street");
    let d = decode(&s, true).unwrap().rgb;
    let total = ((d.width() / 8) * (d.height() / 8)) as usize;
    let m = max_message_bytes(total);
    let t = Instant::now();
    let detail = capacity_detail_core(&s).unwrap();
    assert!(t.elapsed().as_millis() < 200);
    assert_eq!(detail.chars, capacity_core(&s).unwrap());
    assert_eq!(detail.bytes as i64, m);
    assert_eq!(detail.chars as i64, m.min(500));
    assert_eq!(
        capacity_detail_core(&png_bytes(&flat(64, 64, [1, 2, 3]))).unwrap_err(),
        StegError::TooSmall
    );
}

#[test]
fn error_display_strings() {
    let cases = [
        (StegError::NotFound, "No message found, or the password is wrong."),
        (StegError::TooLarge, "Image is too large (max 40 megapixels)."),
        (StegError::Unsupported, "Only PNG and JPEG images are supported."),
        (StegError::Unreadable, "This image couldn't be read. It may be damaged."),
        (StegError::TooSmall, "This image is too small to hold a message."),
        (StegError::TooLong(123), "This image can hold at most 123 characters."),
        (
            StegError::TooLongBytes(456),
            "This message is too long for this image (max 456 bytes).",
        ),
        (StegError::EmptyMessage, "Enter a message."),
        (StegError::EmptyPassword, "Enter a password."),
        (StegError::Internal, "Something went wrong. Please try again."),
    ];
    for (err, expected) in &cases {
        match err {
            StegError::NotFound
            | StegError::TooLarge
            | StegError::Unsupported
            | StegError::Unreadable
            | StegError::TooSmall
            | StegError::TooLong(_)
            | StegError::TooLongBytes(_)
            | StegError::EmptyMessage
            | StegError::EmptyPassword
            | StegError::Internal => {}
        }
        assert_eq!(err.to_string(), *expected);
    }
}

fn derive_order_seed(password: &str, salt: &[u8; 16]) -> [u8; 32] {
    let mut master = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password.as_bytes(), salt, 600_000, &mut master);
    let hk = hkdf::Hkdf::<sha2::Sha256>::new(None, &master);
    let mut seed = [0u8; 32];
    hk.expand(b"steg-mss-io/v1/order", &mut seed).unwrap();
    seed
}

#[test]
fn hostile_reveal_between_714_and_797_blocks() {
    // 714 = 34x21 blocks, 784 = 28x28 blocks, 797 = 797x1 blocks.
    for (w, h) in [(272u32, 168u32), (224, 224), (6376, 8)] {
        let total = steg_core::blocks::Grid::from_dims(w, h).total();
        assert!((714..=797).contains(&total), "total={total}");
        let png = png_bytes(&photo(w, h));
        assert_eq!(reveal_core(&png, PW).unwrap_err(), StegError::NotFound);
    }
}

#[test]
fn hostile_reveal_corrupted_version_byte() {
    use steg_core::blocks::{embed, header_order, read_bits, Grid, DEFAULT_ENCODER};
    use steg_core::ecc::{bits_to_bytes, bytes_to_bits, hamming_decode, hamming_encode};
    use steg_core::image_io::{encode, Format};

    let salt = [7u8; 16];
    let nonce = [9u8; 12];
    let src = png_bytes(&photo(640, 480));
    let out = hide_with(&src, "secret", PW, DEFAULT_ENCODER, salt, nonce).unwrap();
    let dec = decode(&out.bytes, false).unwrap();
    let (w, h) = (dec.rgb.width(), dec.rgb.height());
    let grid = Grid::from_dims(w, h);
    let h_order = header_order(grid.total());

    let mut bad_header = vec![0x02u8];
    bad_header.extend_from_slice(&salt);
    let coded = hamming_encode(&bytes_to_bits(&bad_header));
    let mut tampered_rgb = dec.rgb;
    embed(&mut tampered_rgb, &grid, &h_order, &coded, DEFAULT_ENCODER);

    // Confirm the header actually reads back version 0x02.
    let read_hdr = bits_to_bytes(&hamming_decode(&read_bits(&tampered_rgb, &grid, &h_order, 17 * 2 * 7)));
    assert_eq!(read_hdr[0], 0x02);

    let tampered_png = encode(&tampered_rgb, Format::Png).unwrap();
    assert_eq!(reveal_core(&tampered_png, PW).unwrap_err(), StegError::NotFound);
}

#[test]
fn hostile_reveal_bad_length_field() {
    use steg_core::blocks::{body_order, embed, header_order, read_bits, Grid, DEFAULT_ENCODER};
    use steg_core::ecc::{bits_to_bytes, bytes_to_bits, hamming_decode, hamming_encode};
    use steg_core::image_io::{encode, Format};

    // 640x480 has 4800 total blocks -> 4086 body blocks (enough for 97 bytes total,
    // so length = 500 is within 16..=2016 but does not fit in the image).
    let (w, h) = (640u32, 480u32);
    let base = photo(w, h);
    let grid = Grid::from_dims(w, h);
    let total = grid.total();
    let salt = [0x42u8; 16];
    let h_order = header_order(total);
    let seed = derive_order_seed(PW, &salt);
    let b_order = body_order(total, &h_order, seed);

    let mut header = vec![VERSION];
    header.extend_from_slice(&salt);
    let header_coded = hamming_encode(&bytes_to_bits(&header));

    // Out of range (> 2016), below minimum (< 16), and in-range but too large for this image.
    for fake_len in [2017u16, 65535u16, 15u16, 500u16] {
        let len_coded = hamming_encode(&bytes_to_bits(&fake_len.to_be_bytes()));
        let mut forged_rgb = base.clone();
        embed(&mut forged_rgb, &grid, &h_order, &header_coded, DEFAULT_ENCODER);
        embed(&mut forged_rgb, &grid, &b_order, &len_coded, DEFAULT_ENCODER);

        let lb = bits_to_bytes(&hamming_decode(&read_bits(&forged_rgb, &grid, &b_order, 2 * 2 * 7)));
        assert_eq!(u16::from_be_bytes([lb[0], lb[1]]), fake_len);

        let forged_png = encode(&forged_rgb, Format::Png).unwrap();
        assert_eq!(reveal_core(&forged_png, PW).unwrap_err(), StegError::NotFound, "len={fake_len}");
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(bytes);
    let mut s = String::with_capacity(64);
    for b in digest {
        use std::fmt::Write;
        let _ = write!(&mut s, "{b:02x}");
    }
    s
}

#[test]
fn embed_refactor_is_byte_identical() {
    use steg_core::blocks::DEFAULT_ENCODER;
    let salt = [0x11u8; 16];
    let nonce = [0x22u8; 12];
    let msg = "golden-refactor-check: 秘密 🔐 0123456789";
    let pw = "golden-passphrase";

    // Recorded after switching clipping compensation to iterative per-pixel headroom scaling.
    let cases: [(&str, Vec<u8>, &str); 3] = [
        (
            "photo_png",
            png_bytes(&photo(1600, 1200)),
            "178f4d45634cd0d0bdbab9b6c8d45f49bd9c20e5889439948ab64a8bbc839540",
        ),
        (
            "photo_jpeg",
            jpeg_bytes(&photo(1600, 1200), 90),
            "8e3d1c30094f8f529e5c7279b8558b7448aa2b56f99d4d3495e964757b71e9a3",
        ),
        (
            "sample_street",
            sample("street"),
            "530b15b02f29dff1f7ff0e47cc828e04a0fbd53e397bfa77763cea0dcc647931",
        ),
    ];
    for (name, input, expected) in cases {
        let out = hide_with(&input, msg, pw, DEFAULT_ENCODER, salt, nonce).unwrap();
        assert_eq!(sha256_hex(&out.bytes), expected, "{name}");
    }
}
