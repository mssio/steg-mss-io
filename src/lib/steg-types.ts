/** Canonical fallback error message matching `StegError::Internal`. */
export const GENERIC_FALLBACK = 'Something went wrong. Please try again.'

/** Result of a successful `hide()`. */
export interface HideOutput {
  /** The image with the message embedded. */
  blob: Blob
  /** `image/png` or `image/jpeg`. */
  mime: string
  blocksUsed: number
  blocksTotal: number
}

/** Result of `capacityDetail()`: both the code-point cap and the raw UTF-8 byte cap. */
export interface CapacityDetail {
  chars: number
  bytes: number
}

export type StegWorkerRequest =
  | { id: number; op: 'hide'; image: ArrayBuffer; message: string; password: string }
  | { id: number; op: 'reveal'; image: ArrayBuffer; password: string }
  | { id: number; op: 'capacity'; image: ArrayBuffer }
  | { id: number; op: 'capacityDetail'; image: ArrayBuffer }
  | { id: number; op: 'diff'; original: ArrayBuffer; stego: ArrayBuffer }
  | { id: number; op: 'warm' }

export interface WorkerHideResult {
  bytes: ArrayBuffer
  mime: string
  blocksUsed: number
  blocksTotal: number
}

export type StegWorkerResult = WorkerHideResult | CapacityDetail | string | number | ArrayBuffer | null

export type StegWorkerResponse =
  | { id: number; ok: true; result: StegWorkerResult }
  | { id: number; ok: false; error: string; fatal?: boolean }
