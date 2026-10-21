'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { uniq, uniqBy } from 'lodash-es'
import useSWRInfinite from 'swr/infinite'
import { HISTORY_PAGE_SIZE, HISTORY_POLL_MS } from '@/core/constants'
import { countActive } from '@/core/history-filters'
import { ACTIVE_STATUSES } from '@/core/types'
import type { GenerationListResult, GenerationRecord } from '@/core/types'
import { fetcher } from '@/lib/fetcher'
import { refreshHistory, registerHistoryRefresh } from '@/lib/swr-keys'
import { useHistoryViewStore, type ViewFilters } from './view-store'

const HIDDEN_POLL_MS = 15_000

function historyKey(filters: ViewFilters): string {
  const params = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) })
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.favorite) params.set('favorite', '1')
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)

  const mode = filters.mode ?? 'all'
  if (mode !== 'all') params.set('mode', mode)
  if (filters.tab && filters.tab !== 'all') params.set('tab', filters.tab)

  if (filters.resolution && filters.resolution !== 'all') params.set('resolution', filters.resolution)
  if (filters.aspect && filters.aspect !== 'all') params.set('aspect', filters.aspect)
  if (filters.audio && filters.audio !== 'any') params.set('audio', filters.audio)
  if (filters.model && filters.model !== 'all') params.set('model', filters.model)
  return params.toString()
}

/** Deduped records from every loaded history page. */
const loadedRecords = (pages?: GenerationListResult[]): GenerationRecord[] =>
  uniqBy(pages?.flatMap((page) => page.items) ?? [], 'id')

/** Replaces matching records in one page, keeping order, cursors and counts. */
function patchPage(page: GenerationListResult, byId: Map<string, GenerationRecord>): GenerationListResult {
  if (!page.items.some((item) => byId.has(item.id))) return page
  return { ...page, items: page.items.map((item) => byId.get(item.id) ?? item) }
}

/** Revalidates every loaded history page. */
export function revalidateHistory(): Promise<unknown> {
  return refreshHistory()
}

interface HistoryResult {
  records: GenerationRecord[]
  activeCount: number
  nextCursor: string | null
  isLoading: boolean
  isValidating: boolean
  hasMore: boolean
  loadMore: () => void
  mutateHistory: () => Promise<unknown>
}

export function useHistory(): HistoryResult {
  const filters = useHistoryViewStore((state) => state.filters)
  const query = useMemo(() => historyKey(filters), [filters])

  const {
    data,
    isLoading,
    isValidating,
    size,
    setSize,
    mutate: mutateInfinite,
  } = useSWRInfinite<GenerationListResult>(
    (index, previous) => {
      if (index > 0 && !previous?.nextCursor) return null
      const params = new URLSearchParams(query)
      if (index > 0 && previous?.nextCursor) params.set('cursor', previous.nextCursor)
      return `/api/generations?${params.toString()}`
    },
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: true,
      refreshWhenHidden: true,
    },
  )

  useEffect(() => {
    registerHistoryRefresh(mutateInfinite)
    return () => registerHistoryRefresh(null)
  }, [mutateInfinite])

  const records = useMemo(() => loadedRecords(data), [data])

  // Local active records keep title and overlay honest when the server lags.
  const activeCount = Math.max(data?.[0]?.activeCount ?? 0, countActive(records))
  const nextCursor = data?.at(-1)?.nextCursor ?? null

  const recordsRef = useRef(records)
  useEffect(() => {
    recordsRef.current = records
  }, [records])

  // One ids request per tick while any loaded record is active.
  useEffect(() => {
    if (activeCount <= 0) return
    let stopped = false
    let running = false
    let last = 0

    const tick = async (force = false) => {
      if (running) return
      if (!force && document.hidden && Date.now() - last < HIDDEN_POLL_MS) return
      last = Date.now()
      const ids = uniq(
        recordsRef.current
          .filter((record) => ACTIVE_STATUSES.includes(record.status))
          .map((record) => record.id),
      )
      if (!ids.length) return
      running = true
      try {
        const result = await fetcher<GenerationListResult>(
          `/api/generations?ids=${ids.map(encodeURIComponent).join(',')}`,
        )
        if (stopped) return
        if (result.items.length < ids.length) void revalidateHistory() // some ids no longer exist
        if (!result.items.length) return
        const byId = new Map(result.items.map((record) => [record.id, record]))
        await mutateInfinite(
          (pages) => pages?.map((page) => patchPage(page, byId)),
          false,
        )
      } catch {
        // Next tick retries; polling does not surface transient errors.
      } finally {
        running = false
      }
    }

    const onVisible = () => {
      if (!document.hidden) void tick(true)
    }

    void tick()
    const timer = window.setInterval(() => void tick(), HISTORY_POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [activeCount, mutateInfinite])

  const loadMore = useCallback(() => {
    if (!nextCursor || isValidating) return
    void setSize(size + 1)
  }, [isValidating, nextCursor, setSize, size])

  return {
    records,
    activeCount,
    nextCursor,
    isLoading,
    isValidating,
    hasMore: Boolean(nextCursor),
    loadMore,
    mutateHistory: revalidateHistory,
  }
}
