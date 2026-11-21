use crate::error::StegError;
use image::{
    codecs::{jpeg::JpegDecoder, jpeg::JpegEncoder, png::PngDecoder},
    metadata::Orientation,
    DynamicImage, ExtendedColorType, ImageDecoder, ImageEncoder, ImageFormat, RgbImage,
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
}

fn load<D: ImageDecoder>(
    decoder: D,
    apply_orientation: bool,
) -> Result<RgbImage, StegError> {
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
    // Convert to RGB8 before orientation so any RGBA/16-bit intermediate is dropped
    // immediately rather than surviving rotation or outliving decode().
    let rgb = DynamicImage::from_decoder(decoder)
        .map_err(|_| StegError::Unreadable)?
        .into_rgb8();
    if let Some(o) = orientation.filter(|&o| o != Orientation::NoTransforms) {
        let mut img = DynamicImage::ImageRgb8(rgb);
        img.apply_orientation(o);
        return Ok(img.into_rgb8());
    }
    Ok(rgb)
}

pub fn decode(bytes: &[u8], apply_orientation: bool) -> Result<Decoded, StegError> {
    let format = match image::guess_format(bytes) {
        Ok(ImageFormat::Png) => Format::Png,
        Ok(ImageFormat::Jpeg) => Format::Jpeg,
        _ => return Err(StegError::Unsupported),
    };
    let cur = Cursor::new(bytes);
    let rgb = match format {
        Format::Png => load(
            PngDecoder::new(cur).map_err(|_| StegError::Unreadable)?,
            apply_orientation,
        )?,
        Format::Jpeg => load(
            JpegDecoder::new(cur).map_err(|_| StegError::Unreadable)?,
            apply_orientation,
        )?,
    };
    Ok(Decoded { rgb, format })
}

pub fn encode(rgb: &RgbImage, format: Format) -> Result<Vec<u8>, StegError> {
    let mut out = Vec::new();
    match format {
        Format::Png => rgb
            .write_to(&mut Cursor::new(&mut out), ImageFormat::Png)
            .map_err(|_| StegError::Internal)?,
        Format::Jpeg => JpegEncoder::new_with_quality(&mut out, JPEG_QUALITY)
            .write_image(rgb.as_raw(), rgb.width(), rgb.height(), ExtendedColorType::Rgb8)
            .map_err(|_| StegError::Internal)?,
    }
    Ok(out)
}
