import { useEffect, useState } from 'react'

export type RunStatus = 'idle' | 'running' | 'done' | 'error'

export interface RunState<T> {
  status: RunStatus
  result?: T
  error?: string
}

export interface Runner<T> {
  getState(): RunState<T>
  /** Start `fn`; any earlier run that settles later is ignored. */
  run(fn: () => Promise<T>): void
  /** Back to idle; a run still in flight is ignored when it settles. */
  reset(): void
}

const IDLE = { status: 'idle' } as const

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong.'
}

/**
 * The generation logic behind `useRun`, as a plain function so it can be
 * tested without a DOM. Every `run` and `reset` bumps a generation counter;
 * a promise only reports back if its generation is still the current one.
 */
export function createRunner<T>(onChange: (state: RunState<T>) => void): Runner<T> {
  let generation = 0
  let state: RunState<T> = IDLE

  const set = (next: RunState<T>) => {
    state = next
    onChange(next)
  }

  return {
    getState: () => state,
    run(fn) {
      const gen = ++generation
      set({ status: 'running' })
      let promise: Promise<T>
      try {
        promise = Promise.resolve(fn())
      } catch (err) {
        promise = Promise.reject(err)
      }
      promise.then(
        (result) => {
          if (gen === generation) set({ status: 'done', result })
        },
        (err: unknown) => {
          if (gen === generation) set({ status: 'error', error: messageOf(err) })
        },
      )
    },
    reset() {
      generation++
      set(IDLE)
    },
  }
}

export interface UseRun<T> extends RunState<T> {
  run(fn: () => Promise<T>): void
  reset(): void
}

/** Runs one async job at a time; late results from superseded runs are dropped. */
export function useRun<T>(): UseRun<T> {
  const [state, setState] = useState<RunState<T>>(IDLE)
  const [runner] = useState(() => createRunner<T>(setState))

  // On unmount, anything still running must not report back.
  useEffect(() => () => runner.reset(), [runner])

  return { ...state, run: runner.run, reset: runner.reset }
}
