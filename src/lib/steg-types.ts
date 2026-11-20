/** Result of a successful `hide()`. */
export interface HideOutput {
  /** The image with the message embedded. */
  blob: Blob
  /** `image/png` or `image/jpeg`. */
  mime: string
  blocksUsed: number
  blocksTotal: number
}

export type StegWorkerRequest =
  | { id: number; op: 'hide'; image: ArrayBuffer; message: string; password: string }
  | { id: number; op: 'reveal'; image: ArrayBuffer; password: string }
  | { id: number; op: 'capacity'; image: ArrayBuffer }
  | { id: number; op: 'diff'; original: ArrayBuffer; stego: ArrayBuffer }

export interface WorkerHideResult {
  bytes: ArrayBuffer
  mime: string
  blocksUsed: number
  blocksTotal: number
}

export type StegWorkerResult = WorkerHideResult | string | number | ArrayBuffer

export type StegWorkerResponse =
  | { id: number; ok: true; result: StegWorkerResult }
  | { id: number; ok: false; error: string; fatal?: boolean }
