import { describe, expect, test } from 'bun:test'
import { generatePassphrase, strength } from './passphrase'
import { WORDLIST } from './wordlist'

describe('wordlist', () => {
  test('has ~2k unique, short, lowercase words', () => {
    expect(WORDLIST.length).toBeGreaterThanOrEqual(1900)
    expect(new Set(WORDLIST).size).toBe(WORDLIST.length)
    for (const w of WORDLIST) expect(w).toMatch(/^[a-z]{3,8}$/)
  })
})

describe('generatePassphrase', () => {
  test('6 words from the list by default, joined by "-"', () => {
    const words = generatePassphrase().split('-')
    expect(words).toHaveLength(6)
    for (const w of words) expect(WORDLIST).toContain(w)
  })
  test('respects the word count', () => {
    expect(generatePassphrase(7).split('-')).toHaveLength(7)
  })
  test('two calls differ', () => {
    expect(generatePassphrase()).not.toBe(generatePassphrase())
  })
})

describe('strength', () => {
  test('generated passphrases are strong', () => {
    for (let i = 0; i < 200; i++) expect(strength(generatePassphrase())).toBe('strong')
  })
  test('short passwords are weak', () => {
    expect(strength('abc')).toBe('weak')
    expect(strength('password')).toBe('weak')
  })
  test('repeated or low-variety input is never strong', () => {
    expect(strength('aaaaaaaaaaaaaaaaa')).not.toBe('strong')
    expect(strength('abcabcabcabcabcabc')).not.toBe('strong')
    expect(strength('a'.repeat(200))).not.toBe('strong')
  })
  test('periodic input is never stronger than one period', () => {
    expect(strength('abcdefghijabcdefghij')).not.toBe('strong')
    expect(strength('abcdefghi'.repeat(4))).not.toBe('strong')
    const rank = { weak: 0, fair: 1, strong: 2 } as const
    expect(rank[strength('Tr0ub4dor&3Tr0ub4dor&3')]).toBeLessThanOrEqual(rank[strength('Tr0ub4dor&3')])
  })
  test('medium passwords are fair', () => {
    expect(strength('Tr0ub4dor&3')).toBe('fair')
  })
})
