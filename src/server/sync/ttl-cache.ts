import 'server-only'

import { isNil } from 'lodash-es'

import { globalState } from '../global-state'

export interface TtlCacheOptions {
  key: string
  okTtlMs: number
  failTtlMs: number
}

export interface TtlLoadResult<T> {
  value: T
  isOk: boolean
}

export interface TtlCache<T> {
  get(id: string, load: () => Promise<TtlLoadResult<T>>, isForce?: boolean): Promise<T>
  clear(): void
}

interface TtlCacheEntry<T> {
  value: T
  expiresAt: number
}

/** Caches loaded values by id, with a shorter window for failed loads. */
export function createTtlCache<T>(options: TtlCacheOptions): TtlCache<T> {
  const { key, okTtlMs, failTtlMs } = options
  const entries = globalState<Map<string, TtlCacheEntry<T>>>(key, () => new Map())
  const pending = globalState<Map<string, Promise<T>>>(`${key}:pending`, () => new Map())

  // eslint-disable-next-line @typescript-eslint/max-params -- fixed TtlCache signature
  async function get(
    id: string,
    load: () => Promise<TtlLoadResult<T>>,
    isForce = false,
  ): Promise<T> {
    const cached = entries.get(id)

    if (!isForce && !isNil(cached) && Date.now() < cached.expiresAt) {
      return cached.value
    }

    const running = pending.get(id)

    if (!isNil(running)) {
      return running
    }

    return track(id, runLoad(id, load))
  }

  function track(id: string, next: Promise<T>): Promise<T> {
    pending.set(id, next)

    return next.finally(() => {
      if (pending.get(id) === next) {
        pending.delete(id)
      }
    })
  }

  async function runLoad(id: string, load: () => Promise<TtlLoadResult<T>>): Promise<T> {
    const result = await load()
    const ttlMs = result.isOk ? okTtlMs : failTtlMs

    entries.set(id, { value: result.value, expiresAt: Date.now() + ttlMs })

    return result.value
  }

  function clear(): void {
    entries.clear()
    pending.clear()
  }

  return { get, clear }
}
