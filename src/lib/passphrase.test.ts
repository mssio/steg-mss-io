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
  test('5 words from the list by default, joined by "-"', () => {
    const words = generatePassphrase().split('-')
    expect(words).toHaveLength(5)
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
  test('medium passwords are fair', () => {
    expect(strength('Tr0ub4dor&3')).toBe('fair')
  })
})
