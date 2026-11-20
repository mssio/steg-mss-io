/** Result of a successful `hide()`. */
export interface HideOutput {
  /** The image with the message embedded. */
  blob: Blob
  /** `image/png` or `image/jpeg`. */
  mime: string
  blocksUsed: number
  blocksTotal: number
}
