export { cn } from "cn"

/** True when an event target accepts typed or pasted text (input, textarea, or contenteditable). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false
  if (typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement) return true
  if (typeof HTMLTextAreaElement !== 'undefined' && target instanceof HTMLTextAreaElement) return true
  if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement && target.isContentEditable) return true
  return false
}
