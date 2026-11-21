//! Bit packing and Hamming(7,4) error correction.

/// Each embedded bit is repeated this many times and decoded by majority vote.
pub const REDUNDANCY: usize = 3;

/// Expands bytes to bits (0/1), most significant bit first.
pub fn bytes_to_bits(data: &[u8]) -> Vec<u8> {
    data.iter()
        .flat_map(|b| (0..8).map(move |i| (b >> (7 - i)) & 1))
        .collect()
}

/// Packs bits (MSB first) into bytes. `bits.len()` must be a multiple of 8.
pub fn bits_to_bytes(bits: &[u8]) -> Vec<u8> {
    debug_assert!(bits.len() % 8 == 0);
    bits.chunks_exact(8)
        .map(|c| c.iter().fold(0u8, |acc, &b| (acc << 1) | (b & 1)))
        .collect()
}

/// Hamming(7,4) encode. Codeword layout: `p1 p2 d1 p3 d2 d3 d4`.
/// `bits.len()` must be a multiple of 4.
pub fn hamming_encode(bits: &[u8]) -> Vec<u8> {
    debug_assert!(bits.len() % 4 == 0);
    let mut out = Vec::with_capacity(bits.len() / 4 * 7);
    for c in bits.chunks_exact(4) {
        let (d1, d2, d3, d4) = (c[0] & 1, c[1] & 1, c[2] & 1, c[3] & 1);
        out.extend_from_slice(&[d1 ^ d2 ^ d4, d1 ^ d3 ^ d4, d1, d2 ^ d3 ^ d4, d2, d3, d4]);
    }
    out
}

/// Hamming(7,4) decode, correcting up to one flipped bit per codeword.
/// `coded.len()` must be a multiple of 7.
pub fn hamming_decode(coded: &[u8]) -> Vec<u8> {
    debug_assert!(coded.len() % 7 == 0);
    let mut out = Vec::with_capacity(coded.len() / 7 * 4);
    for w in coded.chunks_exact(7) {
        let mut c = [0u8; 7];
        for (dst, src) in c.iter_mut().zip(w) {
            *dst = src & 1;
        }
        let s1 = c[0] ^ c[2] ^ c[4] ^ c[6];
        let s2 = c[1] ^ c[2] ^ c[5] ^ c[6];
        let s3 = c[3] ^ c[4] ^ c[5] ^ c[6];
        let syndrome = (s1 | (s2 << 1) | (s3 << 2)) as usize;
        if syndrome != 0 {
            c[syndrome - 1] ^= 1;
        }
        out.extend_from_slice(&[c[2], c[4], c[5], c[6]]);
    }
    out
}

/// Majority vote over 0/1 votes; ties resolve to 0.
pub fn majority(votes: &[u8]) -> u8 {
    let ones = votes.iter().filter(|&&v| v & 1 == 1).count();
    (ones * 2 > votes.len()) as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bits_roundtrip() {
        assert_eq!(bits_to_bytes(&bytes_to_bits(b"\x00\xA5\xFF")), b"\x00\xA5\xFF");
        assert_eq!(bytes_to_bits(&[0xA5]), [1, 0, 1, 0, 0, 1, 0, 1]);
    }

    #[test]
    fn hamming_layout() {
        assert_eq!(hamming_encode(&[1, 0, 1, 1]), [0, 1, 1, 0, 0, 1, 1]);
    }

    #[test]
    fn hamming_corrects_every_single_error() {
        for n in 0u8..16 {
            let nibble: Vec<u8> = (0..4).map(|i| (n >> (3 - i)) & 1).collect();
            let code = hamming_encode(&nibble);
            assert_eq!(code.len(), 7);
            assert_eq!(hamming_decode(&code), nibble);
            for pos in 0..7 {
                let mut bad = code.clone();
                bad[pos] ^= 1;
                assert_eq!(hamming_decode(&bad), nibble, "nibble {n} pos {pos}");
            }
        }
    }

    #[test]
    fn majority_votes() {
        assert_eq!(majority(&[1, 0, 1]), 1);
        assert_eq!(majority(&[0, 0, 1]), 0);
    }
}
