use crate::error::StegError;
use image::{
    codecs::{
        jpeg::{JpegDecoder, JpegEncoder},
        png::{PngDecoder, PngEncoder},
    },
    metadata::Orientation,
    DynamicImage, ExtendedColorType, ImageDecoder, ImageEncoder, ImageFormat, RgbImage, RgbaImage,
};
use std::io::Cursor;

pub const MAX_PIXELS: u64 = 40_000_000;
const JPEG_QUALITY: u8 = 92;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Format {
    Png,
    Jpeg,
}

impl Format {
    pub fn mime(&self) -> &'static str {
        match self {
            Format::Png => "image/png",
            Format::Jpeg => "image/jpeg",
        }
    }
}

#[derive(Debug)]
pub struct Decoded {
    pub rgb: RgbImage,
    pub format: Format,
    /// Original alpha plane (row-major, `width * height` bytes) for PNGs with alpha.
    pub alpha: Option<Vec<u8>>,
}

fn split_rgba(rgba: RgbaImage) -> (RgbImage, Vec<u8>) {
    let (w, h) = rgba.dimensions();
    let pixels = (w as usize) * (h as usize);
    let mut rgb = Vec::with_capacity(pixels * 3);
    let mut alpha = Vec::with_capacity(pixels);
    for px in rgba.into_raw().chunks_exact(4) {
        rgb.extend_from_slice(&px[..3]);
        alpha.push(px[3]);
    }
    let rgb = RgbImage::from_raw(w, h, rgb).expect("buffer size matches");
    (rgb, alpha)
}

fn load<D: ImageDecoder>(
    decoder: D,
    apply_orientation: bool,
    keep_alpha: bool,
) -> Result<(RgbImage, Option<Vec<u8>>), StegError> {
    let (w, h) = decoder.dimensions();
    if (w as u64) * (h as u64) > MAX_PIXELS {
        return Err(StegError::TooLarge);
    }
    let mut decoder = decoder;
    let orientation = if apply_orientation {
        decoder.orientation().ok()
    } else {
        None
    };
    let dyn_img = DynamicImage::from_decoder(decoder).map_err(|_| StegError::Unreadable)?;
    if keep_alpha && dyn_img.color().has_alpha() {
        // Convert to RGBA8 before orientation so any 16-bit intermediate is dropped early.
        let mut img = DynamicImage::ImageRgba8(dyn_img.into_rgba8());
        if let Some(o) = orientation.filter(|&o| o != Orientation::NoTransforms) {
            img.apply_orientation(o);
        }
        let (rgb, alpha) = split_rgba(img.into_rgba8());
        return Ok((rgb, Some(alpha)));
    }
    // Convert to RGB8 before orientation so any RGBA/16-bit intermediate is dropped
    // immediately rather than surviving rotation or outliving decode().
    let rgb = dyn_img.into_rgb8();
    if let Some(o) = orientation.filter(|&o| o != Orientation::NoTransforms) {
        let mut img = DynamicImage::ImageRgb8(rgb);
        img.apply_orientation(o);
        return Ok((img.into_rgb8(), None));
    }
    Ok((rgb, None))
}

fn decode_inner(
    bytes: &[u8],
    apply_orientation: bool,
    keep_alpha: bool,
) -> Result<Decoded, StegError> {
    let format = match image::guess_format(bytes) {
        Ok(ImageFormat::Png) => Format::Png,
        Ok(ImageFormat::Jpeg) => Format::Jpeg,
        _ => return Err(StegError::Unsupported),
    };
    let cur = Cursor::new(bytes);
    let (rgb, alpha) = match format {
        Format::Png => load(
            PngDecoder::new(cur).map_err(|_| StegError::Unreadable)?,
            apply_orientation,
            keep_alpha,
        )?,
        Format::Jpeg => load(
            JpegDecoder::new(cur).map_err(|_| StegError::Unreadable)?,
            apply_orientation,
            false,
        )?,
    };
    Ok(Decoded { rgb, format, alpha })
}

pub fn decode(bytes: &[u8], apply_orientation: bool) -> Result<Decoded, StegError> {
    decode_inner(bytes, apply_orientation, true)
}

/// Decodes to RGB8 only, dropping any alpha channel immediately to minimise peak memory.
pub fn decode_rgb(bytes: &[u8], apply_orientation: bool) -> Result<Decoded, StegError> {
    decode_inner(bytes, apply_orientation, false)
}

pub fn encode_with_alpha(
    rgb: RgbImage,
    alpha: Option<Vec<u8>>,
    format: Format,
) -> Result<Vec<u8>, StegError> {
    let mut out = Vec::new();
    match format {
        Format::Png => {
            let (w, h) = rgb.dimensions();
            if let Some(alpha) = alpha {
                let pixels = (w as usize) * (h as usize);
                if alpha.len() != pixels {
                    return Err(StegError::Internal);
                }
                let mut rgba = Vec::with_capacity(pixels * 4);
                for (px, a) in rgb.into_raw().chunks_exact(3).zip(alpha.into_iter()) {
                    rgba.extend_from_slice(px);
                    rgba.push(a);
                }
                // `rgb` and `alpha` are freed before PNG compression allocates its buffers.
                PngEncoder::new(&mut out)
                    .write_image(&rgba, w, h, ExtendedColorType::Rgba8)
                    .map_err(|_| StegError::Internal)?;
            } else {
                PngEncoder::new(&mut out)
                    .write_image(rgb.as_raw(), w, h, ExtendedColorType::Rgb8)
                    .map_err(|_| StegError::Internal)?;
            }
        }
        Format::Jpeg => {
            drop(alpha);
            JpegEncoder::new_with_quality(&mut out, JPEG_QUALITY)
                .write_image(rgb.as_raw(), rgb.width(), rgb.height(), ExtendedColorType::Rgb8)
                .map_err(|_| StegError::Internal)?;
        }
    }
    Ok(out)
}

pub fn encode(rgb: &RgbImage, format: Format) -> Result<Vec<u8>, StegError> {
    let mut out = Vec::new();
    match format {
        Format::Png => PngEncoder::new(&mut out)
            .write_image(rgb.as_raw(), rgb.width(), rgb.height(), ExtendedColorType::Rgb8)
            .map_err(|_| StegError::Internal)?,
        Format::Jpeg => JpegEncoder::new_with_quality(&mut out, JPEG_QUALITY)
            .write_image(rgb.as_raw(), rgb.width(), rgb.height(), ExtendedColorType::Rgb8)
            .map_err(|_| StegError::Internal)?,
    }
    Ok(out)
}
