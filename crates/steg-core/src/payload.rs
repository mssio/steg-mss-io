//! Format v1 payload, crypto and the plain-Rust public API.

use crate::blocks::{
    body_order, embed, header_order, read_bits, Encoder, Grid, DEFAULT_ENCODER, HEADER_BLOCKS,
};
use crate::ecc::{bits_to_bytes, bytes_to_bits, hamming_decode, hamming_encode, REDUNDANCY};
use crate::error::StegError;
use crate::image_io::{decode, encode, Format};
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use hkdf::Hkdf;
use image::RgbImage;
use sha2::Sha256;

pub const VERSION: u8 = 0x01;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const TAG_LEN: usize = 16;
const PBKDF2_ITERS: u32 = 600_000;
const MAX_CHARS: usize = 500;
const MIN_LEN: usize = TAG_LEN;
const MAX_LEN: usize = MAX_CHARS * 4 + TAG_LEN;
/// Coded bits per payload byte (2 nibbles x 7 bits) and blocks per byte (x redundancy).
const BLOCKS_PER_BYTE: usize = 2 * 7 * REDUNDANCY;
const LEN_FIELD_BLOCKS: usize = 2 * BLOCKS_PER_BYTE;

pub struct Hidden {
    pub bytes: Vec<u8>,
    pub mime: String,
    pub blocks_used: u32,
    pub blocks_total: u32,
}

// Manual Debug so image bytes never end up in logs or panic messages.
impl std::fmt::Debug for Hidden {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Hidden")
            .field("len", &self.bytes.len())
            .field("mime", &self.mime)
            .field("blocks_used", &self.blocks_used)
            .field("blocks_total", &self.blocks_total)
            .finish()
    }
}

/// `floor(floor((total - 714) / 21) / 2) - 30`; may be negative.
pub fn max_message_bytes(total_blocks: usize) -> i64 {
    let avail = total_blocks as i64 - HEADER_BLOCKS as i64;
    avail.div_euclid(21).div_euclid(2) - (2 + NONCE_LEN + TAG_LEN) as i64
}

fn derive(password: &str, salt: &[u8; SALT_LEN]) -> ([u8; 32], [u8; 32]) {
    let mut master = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERS, &mut master);
    let hk = Hkdf::<Sha256>::new(None, &master);
    let mut seed = [0u8; 32];
    let mut key = [0u8; 32];
    hk.expand(b"steg-mss-io/v1/order", &mut seed).expect("32 bytes is a valid length");
    hk.expand(b"steg-mss-io/v1/aes", &mut key).expect("32 bytes is a valid length");
    (seed, key)
}

fn aad(salt: &[u8; SALT_LEN]) -> Vec<u8> {
    let mut a = vec![VERSION];
    a.extend_from_slice(salt);
    a
}

fn encode_bytes(data: &[u8]) -> Vec<u8> {
    hamming_encode(&bytes_to_bits(data))
}

pub fn hide_core(image: &[u8], message: &str, password: &str) -> Result<Hidden, StegError> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce = [0u8; NONCE_LEN];
    // Validate cheap inputs before spending entropy or time.
    if password.is_empty() {
        return Err(StegError::EmptyPassword);
    }
    getrandom::fill(&mut salt).map_err(|_| StegError::NotFound)?;
    getrandom::fill(&mut nonce).map_err(|_| StegError::NotFound)?;
    hide_with(image, message, password, DEFAULT_ENCODER, salt, nonce)
}

pub fn hide_with(
    image: &[u8],
    message: &str,
    password: &str,
    enc: Encoder,
    salt: [u8; SALT_LEN],
    nonce: [u8; NONCE_LEN],
) -> Result<Hidden, StegError> {
    if password.is_empty() {
        return Err(StegError::EmptyPassword);
    }
    if message.is_empty() {
        return Err(StegError::EmptyMessage);
    }
    let dec = decode(image, true)?;
    let (w, h) = (dec.rgb.width(), dec.rgb.height());
    let grid = Grid::from_dims(w, h);
    let total = grid.total();
    let m = max_message_bytes(total);
    if m < 1 {
        return Err(StegError::TooSmall);
    }
    if message.chars().count() > MAX_CHARS || message.len() as i64 > m {
        return Err(StegError::TooLong(m.min(MAX_CHARS as i64) as u32));
    }

    let (seed, key) = derive(password, &salt);
    let cipher = Aes256Gcm::new_from_slice(&key).expect("32-byte key");
    let ct = cipher
        .encrypt(
            &Nonce::from(nonce),
            Payload { msg: message.as_bytes(), aad: &aad(&salt) },
        )
        .map_err(|_| StegError::NotFound)?;

    let mut header = vec![VERSION];
    header.extend_from_slice(&salt);
    let mut body = (ct.len() as u16).to_be_bytes().to_vec();
    body.extend_from_slice(&nonce);
    body.extend_from_slice(&ct);

    let header_coded = encode_bytes(&header);
    let body_coded = encode_bytes(&body);
    let h_order = header_order(total);
    let b_order = body_order(total, &h_order, seed);
    debug_assert!(b_order.len() >= body_coded.len() * REDUNDANCY);

    let mut px: Vec<f32> = dec.rgb.as_raw().iter().map(|&v| v as f32).collect();
    embed(&mut px, &grid, w, &h_order, &header_coded, enc);
    embed(&mut px, &grid, w, &b_order, &body_coded, enc);
    let raw: Vec<u8> = px.iter().map(|v| v.round().clamp(0.0, 255.0) as u8).collect();
    let out = RgbImage::from_raw(w, h, raw).expect("buffer size matches");
    let bytes = encode(&out, dec.format)?;
    Ok(Hidden {
        bytes,
        mime: dec.format.mime().to_string(),
        blocks_used: (HEADER_BLOCKS + body_coded.len() * REDUNDANCY) as u32,
        blocks_total: total as u32,
    })
}

fn has_image_magic(bytes: &[u8]) -> bool {
    matches!(
        image::guess_format(bytes),
        Ok(image::ImageFormat::Png) | Ok(image::ImageFormat::Jpeg)
    )
}

pub fn reveal_core(image: &[u8], password: &str) -> Result<String, StegError> {
    let dec = match decode(image, false) {
        Ok(d) => d,
        Err(StegError::TooLarge) => return Err(StegError::TooLarge),
        Err(_) if has_image_magic(image) => return Err(StegError::NotFound),
        Err(e) => return Err(e),
    };
    reveal_rgb(&dec.rgb, password).ok_or(StegError::NotFound)
}

fn reveal_rgb(rgb: &RgbImage, password: &str) -> Option<String> {
    let grid = Grid::from_dims(rgb.width(), rgb.height());
    let total = grid.total();
    if total < HEADER_BLOCKS + LEN_FIELD_BLOCKS {
        return None;
    }
    let h_order = header_order(total);
    let header_coded = read_bits(rgb, &grid, &h_order, 17 * 2 * 7);
    let header = bits_to_bytes(&hamming_decode(&header_coded));
    if header[0] != VERSION {
        return None;
    }
    let salt: [u8; SALT_LEN] = header[1..17].try_into().ok()?;

    let (seed, key) = derive(password, &salt);
    let b_order = body_order(total, &h_order, seed);
    let len_bits = read_bits(rgb, &grid, &b_order, 2 * 2 * 7);
    let lb = bits_to_bytes(&hamming_decode(&len_bits));
    let len = u16::from_be_bytes([lb[0], lb[1]]) as usize;
    if !(MIN_LEN..=MAX_LEN).contains(&len) {
        return None;
    }
    let body_len = 2 + NONCE_LEN + len;
    if body_len * BLOCKS_PER_BYTE > b_order.len() {
        return None;
    }
    let coded = read_bits(rgb, &grid, &b_order, body_len * 2 * 7);
    let body = bits_to_bytes(&hamming_decode(&coded));
    let nonce: [u8; NONCE_LEN] = body[2..2 + NONCE_LEN].try_into().ok()?;
    let ct = &body[2 + NONCE_LEN..];
    let cipher = Aes256Gcm::new_from_slice(&key).ok()?;
    let pt = cipher
        .decrypt(&Nonce::from(nonce), Payload { msg: ct, aad: &aad(&salt) })
        .ok()?;
    String::from_utf8(pt).ok()
}

pub fn capacity_core(image: &[u8]) -> Result<u32, StegError> {
    let dec = decode(image, true)?;
    let m = max_message_bytes(Grid::from_dims(dec.rgb.width(), dec.rgb.height()).total());
    if m < 1 {
        return Err(StegError::TooSmall);
    }
    Ok(m.min(MAX_CHARS as i64) as u32)
}

pub fn diff_preview_core(original: &[u8], stego: &[u8]) -> Result<Vec<u8>, StegError> {
    let a = decode(original, true)?.rgb;
    let b = decode(stego, false)?.rgb;
    if a.dimensions() != b.dimensions() {
        return Err(StegError::NotFound);
    }
    let raw: Vec<u8> = a
        .as_raw()
        .iter()
        .zip(b.as_raw())
        .map(|(&x, &y)| (x.abs_diff(y) as u16 * 8).min(255) as u8)
        .collect();
    let out = RgbImage::from_raw(a.width(), a.height(), raw).expect("buffer size matches");
    encode(&out, Format::Png)
}
