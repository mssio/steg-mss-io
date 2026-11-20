import { describe, expect, test } from 'bun:test'
import { createRunner, type RunState } from './useRun'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function setup<T>() {
  const states: RunState<T>[] = []
  const runner = createRunner<T>((s) => states.push(s))
  return { runner, states, last: () => states.at(-1) }
}

describe('createRunner', () => {
  test('starts idle', () => {
    const { runner } = setup<string>()
    expect(runner.getState()).toEqual({ status: 'idle' })
  })

  test('running, then done with the result', async () => {
    const { runner, last } = setup<string>()
    const d = deferred<string>()
    runner.run(() => d.promise)
    expect(last()).toEqual({ status: 'running' })
    d.resolve('ok')
    await flush()
    expect(last()).toEqual({ status: 'done', result: 'ok' })
  })

  test('a rejection becomes an error with its message', async () => {
    const { runner, last } = setup<string>()
    runner.run(() => Promise.reject(new Error('Enter a password.')))
    await flush()
    expect(last()).toEqual({ status: 'error', error: 'Enter a password.' })
  })

  test('a synchronous throw becomes an error too', async () => {
    const { runner, last } = setup<string>()
    runner.run(() => {
      throw new Error('boom')
    })
    await flush()
    expect(last()).toEqual({ status: 'error', error: 'boom' })
  })

  test('slow first run, fast second run: only the second result is kept', async () => {
    const { runner, states, last } = setup<string>()
    const slow = deferred<string>()
    const fast = deferred<string>()
    runner.run(() => slow.promise)
    runner.run(() => fast.promise)
    fast.resolve('second')
    await flush()
    expect(last()).toEqual({ status: 'done', result: 'second' })
    slow.resolve('first')
    await flush()
    expect(last()).toEqual({ status: 'done', result: 'second' })
    expect(states.some((s) => s.result === 'first')).toBe(false)
  })

  test('a stale rejection is ignored as well', async () => {
    const { runner, last } = setup<string>()
    const slow = deferred<string>()
    runner.run(() => slow.promise)
    runner.run(() => Promise.resolve('second'))
    await flush()
    slow.reject(new Error('late'))
    await flush()
    expect(last()).toEqual({ status: 'done', result: 'second' })
  })

  test('reset() during a run drops the result', async () => {
    const { runner, states, last } = setup<string>()
    const d = deferred<string>()
    runner.run(() => d.promise)
    runner.reset()
    expect(last()).toEqual({ status: 'idle' })
    d.resolve('late')
    await flush()
    expect(last()).toEqual({ status: 'idle' })
    expect(runner.getState()).toEqual({ status: 'idle' })
    expect(states.some((s) => s.status === 'done')).toBe(false)
  })
})
