import { WORDLIST } from './wordlist'

export type Strength = 'weak' | 'fair' | 'strong'

/** Uniform random integer in [0, n) from `crypto.getRandomValues`, via rejection sampling. */
function randomIndex(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n
  const buf = new Uint32Array(1)
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % n
  }
}

/** `words` random words from the built-in list, joined by `-`. */
export function generatePassphrase(words = 6): string {
  return Array.from({ length: words }, () => WORDLIST[randomIndex(WORDLIST.length)]).join('-')
}

/**
 * Smallest period of `chars` (prefix function / KMP): `p` if the input is its
 * first `p` characters repeated a whole number of times, else its length.
 */
function smallestPeriod(chars: string[]): number {
  const n = chars.length
  const pi = new Array<number>(n).fill(0)
  for (let i = 1; i < n; i++) {
    let k = pi[i - 1]
    while (k > 0 && chars[i] !== chars[k]) k = pi[k - 1]
    if (chars[i] === chars[k]) k++
    pi[i] = k
  }
  const p = n - (pi[n - 1] ?? 0)
  return n > 0 && n % p === 0 ? p : n
}

/**
 * A deliberately simple hint: estimated bits = effective length × log2(pool
 * size), where the pool grows with each character class used. The effective
 * length is capped at the smallest period (a repeated string counts once) and
 * at 3 × the number of distinct characters, so repeated or low-variety input
 * ("aaaa…", "abcabc…", "pass1pass1") is never rated stronger than its parts. Not a cracking
 * estimate. (A generated 6-word passphrase has log2(2244) × 6 ≈ 66.8 bits of
 * real entropy.)
 */
export function strength(pw: string): Strength {
  const chars = [...pw]
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^a-zA-Z0-9\u0080-\u{10FFFF}]/u.test(pw)) pool += 33
  if (/[\u0080-\u{10FFFF}]/u.test(pw)) pool += 100
  const effective = Math.min(chars.length, smallestPeriod(chars), new Set(chars).size * 3)
  const bits = effective * Math.log2(Math.max(pool, 1))
  if (bits >= 80) return 'strong'
  if (bits >= 45) return 'fair'
  return 'weak'
}
