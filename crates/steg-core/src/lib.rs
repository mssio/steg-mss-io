pub mod blocks;
pub mod ecc;
pub mod error;
pub mod image_io;
pub mod payload;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct HideResult {
    bytes: Vec<u8>,
    mime: String,
    blocks_used: u32,
    blocks_total: u32,
}

#[wasm_bindgen]
impl HideResult {
    #[wasm_bindgen(getter)]
    pub fn bytes(&self) -> Vec<u8> {
        self.bytes.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn mime(&self) -> String {
        self.mime.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn blocks_used(&self) -> u32 {
        self.blocks_used
    }
    #[wasm_bindgen(getter)]
    pub fn blocks_total(&self) -> u32 {
        self.blocks_total
    }
}

fn js(e: error::StegError) -> JsError {
    JsError::new(&e.to_string())
}

#[wasm_bindgen]
pub fn hide(image: &[u8], message: &str, password: &str) -> Result<HideResult, JsError> {
    let h = payload::hide_core(image, message, password).map_err(js)?;
    Ok(HideResult {
        bytes: h.bytes,
        mime: h.mime,
        blocks_used: h.blocks_used,
        blocks_total: h.blocks_total,
    })
}

#[wasm_bindgen]
pub fn reveal(image: &[u8], password: &str) -> Result<String, JsError> {
    payload::reveal_core(image, password).map_err(js)
}

#[wasm_bindgen]
pub fn capacity(image: &[u8]) -> Result<u32, JsError> {
    payload::capacity_core(image).map_err(js)
}

#[wasm_bindgen]
pub fn diff_preview(original: &[u8], stego: &[u8]) -> Result<Vec<u8>, JsError> {
    payload::diff_preview_core(original, stego).map_err(js)
}
