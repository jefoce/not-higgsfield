import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TtlLoadResult } from '@/server/sync/ttl-cache'
import { createTtlCache } from '@/server/sync/ttl-cache'

const useClock = (start: number) => {
  let now = start

  vi.spyOn(Date, 'now').mockImplementation(() => now)

  return (elapsedMs: number) => {
    now += elapsedMs
  }
}

const value = (next: number, isOk = true): TtlLoadResult<number> => ({ value: next, isOk })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createTtlCache', () => {
  it('returns a fresh cached value without loading again', async () => {
    useClock(1_000)

    const cache = createTtlCache<number>({ key: 'test-fresh', okTtlMs: 100, failTtlMs: 10 })
    const load = vi.fn(async () => value(1))

    expect(await cache.get('a', load)).toBe(1)
    expect(await cache.get('a', load)).toBe(1)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('loads again once an ok value expires', async () => {
    const advance = useClock(1_000)

    const cache = createTtlCache<number>({ key: 'test-ok-expiry', okTtlMs: 100, failTtlMs: 10 })
    const load = vi.fn().mockResolvedValueOnce(value(1)).mockResolvedValueOnce(value(2))

    expect(await cache.get('a', load)).toBe(1)

    advance(101)

    expect(await cache.get('a', load)).toBe(2)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('uses the failure ttl for a failed load', async () => {
    const advance = useClock(1_000)

    const cache = createTtlCache<number>({ key: 'test-fail', okTtlMs: 100, failTtlMs: 10 })
    const load = vi.fn(async () => value(0, false))

    expect(await cache.get('a', load)).toBe(0)

    advance(5)

    expect(await cache.get('a', load)).toBe(0)
    expect(load).toHaveBeenCalledTimes(1)

    advance(6)

    expect(await cache.get('a', load)).toBe(0)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('loads again when forced, even while fresh', async () => {
    useClock(1_000)

    const cache = createTtlCache<number>({ key: 'test-force', okTtlMs: 100, failTtlMs: 10 })
    const load = vi.fn().mockResolvedValueOnce(value(1)).mockResolvedValueOnce(value(2))

    expect(await cache.get('a', load)).toBe(1)
    expect(await cache.get('a', load, true)).toBe(2)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('loads again after clear', async () => {
    useClock(1_000)

    const cache = createTtlCache<number>({ key: 'test-clear', okTtlMs: 100, failTtlMs: 10 })
    const load = vi.fn().mockResolvedValueOnce(value(1)).mockResolvedValueOnce(value(2))

    expect(await cache.get('a', load)).toBe(1)

    cache.clear()

    expect(await cache.get('a', load)).toBe(2)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
