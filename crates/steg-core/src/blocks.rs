//! Block grid, public/keyed block orders, and the DCT-robust embedding encoder.

use crate::ecc::REDUNDANCY;
use image::RgbImage;
use rand_chacha::ChaCha20Rng;
use rand_core::{Rng, SeedableRng};
use sha2::{Digest, Sha256};

pub const BLOCK: u32 = 8;
pub const HEADER_BLOCKS: usize = 714;
pub const STRENGTH: f32 = 25.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Grid {
    pub bw: u32,
    pub bh: u32,
}

impl Grid {
    pub fn from_dims(w: u32, h: u32) -> Self {
        Grid { bw: w / BLOCK, bh: h / BLOCK }
    }
    pub fn total(&self) -> usize {
        self.bw as usize * self.bh as usize
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Encoder {
    Python,
    Adjusted,
    AdjustedCap(f32),
    AdjustedMargin(f32),
}

pub const DEFAULT_ENCODER: Encoder = Encoder::Adjusted;

/// Fisher-Yates with rejection sampling; independent of `rand` internals.
pub fn shuffle(v: &mut [u32], rng: &mut ChaCha20Rng) {
    for i in (1..v.len()).rev() {
        let n = (i + 1) as u64;
        let zone = u64::MAX - (u64::MAX % n);
        let j = loop {
            let r = rng.next_u64();
            if r < zone {
                break (r % n) as usize;
            }
        };
        v.swap(i, j);
    }
}

pub fn header_order(total: usize) -> Vec<u32> {
    let seed: [u8; 32] = Sha256::digest(b"steg-mss-io/v1/header").into();
    let mut v: Vec<u32> = (0..total as u32).collect();
    shuffle(&mut v, &mut ChaCha20Rng::from_seed(seed));
    v.truncate(HEADER_BLOCKS);
    v
}

pub fn body_order(total: usize, header: &[u32], seed: [u8; 32]) -> Vec<u32> {
    let mut used = vec![false; total];
    for &h in header {
        used[h as usize] = true;
    }
    let mut v: Vec<u32> = (0..total as u32).filter(|&i| !used[i as usize]).collect();
    shuffle(&mut v, &mut ChaCha20Rng::from_seed(seed));
    v
}

#[inline]
fn lum(p: [f32; 3]) -> f32 {
    0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
}

#[inline]
fn is_centre(dx: u32, dy: u32) -> bool {
    (2..6).contains(&dx) && (2..6).contains(&dy)
}

/// Mean luminance of (centre, edge) for the block at (bx, by); `get(x, y)` yields RGB.
fn centre_edge(get: &impl Fn(u32, u32) -> [f32; 3], bx: u32, by: u32) -> (f32, f32) {
    let (mut c, mut e) = (0.0f32, 0.0f32);
    for dy in 0..BLOCK {
        for dx in 0..BLOCK {
            let y = lum(get(bx * BLOCK + dx, by * BLOCK + dy));
            if is_centre(dx, dy) {
                c += y;
            } else {
                e += y;
            }
        }
    }
    (c / 16.0, e / 48.0)
}

/// Centre-minus-edge mean luminance of one block. Shared by embed and read.
pub fn block_diff(get: &impl Fn(u32, u32) -> [f32; 3], bx: u32, by: u32) -> f32 {
    let (c, e) = centre_edge(get, bx, by);
    c - e
}

fn f32_getter(px: &[f32], width: u32) -> impl Fn(u32, u32) -> [f32; 3] + '_ {
    move |x, y| {
        let i = (y as usize * width as usize + x as usize) * 3;
        [px[i], px[i + 1], px[i + 2]]
    }
}

fn shift_region(px: &mut [f32], width: u32, bx: u32, by: u32, centre: bool, amt: f32) {
    for dy in 0..BLOCK {
        for dx in 0..BLOCK {
            if is_centre(dx, dy) == centre {
                let i = ((by * BLOCK + dy) as usize * width as usize + (bx * BLOCK + dx) as usize) * 3;
                for ch in 0..3 {
                    px[i + ch] = (px[i + ch] + amt).clamp(0.0, 255.0);
                }
            }
        }
    }
}

pub fn embed(px: &mut [f32], grid: &Grid, width: u32, order: &[u32], coded: &[u8], enc: Encoder) {
    for (k, &bit) in coded.iter().enumerate() {
        let sgn = if bit == 1 { 1.0f32 } else { -1.0 };
        for &blk in &order[k * REDUNDANCY..(k + 1) * REDUNDANCY] {
            let (bx, by) = (blk % grid.bw, blk / grid.bw);
            let margin = if let Encoder::AdjustedMargin(m) = enc { m } else { 1.0 };
            let t = sgn * STRENGTH * margin;
            let mut o = t;
            // Diff the clipping compensation aims at: `t`, or for the capped variant the
            // capped offset's own result (so the push does not undo the cap).
            let mut aim = t;
            if enc != Encoder::Python {
                let d = block_diff(&f32_getter(px, width), bx, by);
                if d.signum() != t.signum() {
                    o = t - d;
                }
                if let Encoder::AdjustedCap(cap) = enc {
                    let capped = o.clamp(-cap * STRENGTH, cap * STRENGTH);
                    if capped != o {
                        aim = d + capped;
                        o = capped;
                    }
                }
            }
            shift_region(px, width, bx, by, true, o / 2.0);
            shift_region(px, width, bx, by, false, -o / 2.0);
            if enc == Encoder::Python {
                continue;
            }
            // Compensate for clipping: push the region with headroom by the shortfall.
            let (c, e) = centre_edge(&f32_getter(px, width), bx, by);
            let shortfall = aim - (c - e);
            if shortfall * aim.signum() > 0.0 {
                let (c_room, e_room) = if aim > 0.0 { (255.0 - c, e) } else { (c, 255.0 - e) };
                if c_room >= e_room {
                    shift_region(px, width, bx, by, true, shortfall);
                } else {
                    shift_region(px, width, bx, by, false, -shortfall);
                }
            }
        }
    }
}

pub fn read_bits(rgb: &RgbImage, grid: &Grid, order: &[u32], n_coded: usize) -> Vec<u8> {
    let get = |x: u32, y: u32| {
        let p = rgb.get_pixel(x, y).0;
        [p[0] as f32, p[1] as f32, p[2] as f32]
    };
    (0..n_coded)
        .map(|k| {
            let votes: Vec<u8> = order[k * REDUNDANCY..(k + 1) * REDUNDANCY]
                .iter()
                .map(|&blk| (block_diff(&get, blk % grid.bw, blk / grid.bw) > 0.0) as u8)
                .collect();
            crate::ecc::majority(&votes)
        })
        .collect()
}
