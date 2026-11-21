import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { isEditableTarget } from './utils'

class FakeHTMLElement {
  isContentEditable: boolean
  constructor(editable = false) {
    this.isContentEditable = editable
  }
}

class FakeHTMLInputElement extends FakeHTMLElement {}
class FakeHTMLTextAreaElement extends FakeHTMLElement {}

const g = globalThis as Record<string, unknown>

beforeEach(() => {
  g.HTMLElement = FakeHTMLElement
  g.HTMLInputElement = FakeHTMLInputElement
  g.HTMLTextAreaElement = FakeHTMLTextAreaElement
})

afterEach(() => {
  delete g.HTMLElement
  delete g.HTMLInputElement
  delete g.HTMLTextAreaElement
})

describe('isEditableTarget', () => {
  test('returns true for input, textarea, and contenteditable elements', () => {
    expect(isEditableTarget(new FakeHTMLInputElement() as unknown as EventTarget)).toBe(true)
    expect(isEditableTarget(new FakeHTMLTextAreaElement() as unknown as EventTarget)).toBe(true)
    expect(isEditableTarget(new FakeHTMLElement(true) as unknown as EventTarget)).toBe(true)
  })

  test('returns false for null, non-editable elements, and non-element targets', () => {
    expect(isEditableTarget(null)).toBe(false)
    expect(isEditableTarget(new FakeHTMLElement(false) as unknown as EventTarget)).toBe(false)
    expect(isEditableTarget({} as EventTarget)).toBe(false)
  })
})
