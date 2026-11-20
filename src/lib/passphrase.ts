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
export function generatePassphrase(words = 5): string {
  return Array.from({ length: words }, () => WORDLIST[randomIndex(WORDLIST.length)]).join('-')
}

/**
 * A deliberately simple hint: estimated bits = length × log2(pool size), where
 * the pool grows with each character class used. Not a cracking estimate.
 */
export function strength(pw: string): Strength {
  const chars = [...pw]
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^a-zA-Z0-9\u0080-\u{10FFFF}]/u.test(pw)) pool += 33
  if (/[\u0080-\u{10FFFF}]/u.test(pw)) pool += 100
  const bits = chars.length * Math.log2(Math.max(pool, 1))
  if (bits >= 80) return 'strong'
  if (bits >= 45) return 'fair'
  return 'weak'
}
