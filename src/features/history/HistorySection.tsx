'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useGeneratorStore } from '@/features/generator/store'
import { HistoryGrid } from './HistoryGrid'
import { HistoryList } from './HistoryList'
import { HistoryModal } from './HistoryModal'
import { HistoryToolbar } from './HistoryToolbar'
import { SelectionBar } from './SelectionBar'
import { cn } from '@/lib/cn'
import { isSelectable } from './record-view'
import { useSelectionStore } from './selection-store'
import { useHistory } from './use-history'
import { useHistoryViewStore } from './view-store'
import { useJobNotifications } from './use-job-notifications'

function SkeletonRows() {
  return (
    <div aria-hidden>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="mb-5 grid grid-cols-[minmax(0,1fr)_240px] gap-3 pl-1 pt-1">
          <div className="h-56 animate-pulse rounded-2xl bg-page-2" />
          <div className="h-56 animate-pulse rounded-2xl bg-page-2" />
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <p className="text-sm font-medium text-fg">No generations yet</p>
      <p className="text-xs text-fg-2">Generated videos will appear here.</p>
    </div>
  )
}

/** Right-hand feed: toolbar, list or grid, infinite scroll and grid details modal. */
export function HistorySection() {
  const { records, activeCount, isLoading, hasMore, loadMore } = useHistory()
  const view = useHistoryViewStore((state) => state.view)
  const filters = useHistoryViewStore((state) => state.filters)
  const selecting = useSelectionStore((state) => state.ids.size > 0)
  const setActiveCount = useGeneratorStore((state) => state.setActiveCount)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = records.find((record) => record.id === selectedId) ?? null
  const sentinel = useRef<HTMLDivElement>(null)
  const order = useMemo(
    () => records.filter(isSelectable).map((record) => record.id),
    [records],
  )
  useJobNotifications({ records, activeCount, isLoading })

  useEffect(() => {
    setActiveCount(activeCount)
  }, [activeCount, setActiveCount])

  // Filter, search and view changes end the selection. Zoom and polling do not.
  useEffect(() => {
    useSelectionStore.getState().clear()
  }, [view, filters])

  useEffect(() => {
    useSelectionStore.getState().setOrder(order)
  }, [order])

  useEffect(() => {
    useSelectionStore.getState().prune(new Set(records.map((record) => record.id)))
  }, [records])

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasMore) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore()
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  return (
    <section id="history-section" className="relative flex h-full flex-col overflow-hidden">
      <HistoryToolbar />
      <div className={cn('flex-1 overflow-y-auto px-4', selecting ? 'pb-28' : 'pb-14')}>
        {!!isLoading && records.length === 0 && <SkeletonRows />}
        {!isLoading && records.length === 0 && <EmptyState />}
        {view === 'list' ? (
          <HistoryList records={records} />
        ) : (
          <HistoryGrid records={records} onOpen={(record) => setSelectedId(record.id)} />
        )}
        {!!hasMore && <div ref={sentinel} className="h-8" />}
      </div>
      <SelectionBar records={records} />
      <HistoryModal
        record={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        onDeleted={() => setSelectedId(null)}
      />
    </section>
  )
}
