mod common;
use common::*;
use steg_core::image_io::decode;
use steg_core::payload::{hide_core, reveal_core};

/// Spec 6.6 gate: the default encoder survives a single q75 recompression.
#[test]
fn default_encoder_passes_gate() {
    let msg: String = (0..500).map(|i| (b'a' + (i * 7 % 26) as u8) as char).collect();
    let cases: Vec<(&str, Vec<u8>)> = vec![
        ("still-life", sample("still-life")),
        ("landscape", sample("landscape")),
        ("street", sample("street")),
        ("photo", png_bytes(&photo(1600, 1200))),
        ("flat", png_bytes(&flat(1600, 1200, [120, 90, 60]))),
    ];
    for (name, bytes) in cases {
        let hidden = hide_core(&bytes, &msg, "gate-pass").unwrap_or_else(|e| panic!("{name}: hide {e:?}"));
        let rgb = decode(&hidden.bytes, false).unwrap().rgb;
        let recompressed = jpeg_bytes(&rgb, 75);
        let got = reveal_core(&recompressed, "gate-pass").unwrap_or_else(|e| panic!("{name}: reveal {e:?}"));
        assert_eq!(got, msg, "{name}");
    }
}
