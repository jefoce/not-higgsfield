'use client'

import { Folder } from 'lucide-react'
import { FilterPopover } from './FilterPopover'
import { ViewToggle } from './ViewToggle'
import { ZoomSlider } from './ZoomSlider'
import { countActiveFilters, useHistoryViewStore } from './view-store'

/** Fixed history header: section pill, zoom, view switch and filters. */
export function HistoryToolbar() {
  const filters = useHistoryViewStore((state) => state.filters)

  return (
    <div className="flex h-14 items-center justify-between gap-3 px-4">
      <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-hover bg-linear-[123.898deg] from-toolbar-start from-[22.606%] via-toolbar-mid via-[51.256%] to-toolbar-end to-[79.906%] bg-glass px-2 py-1 text-xs font-medium leading-4 text-fg shadow-toolbar">
        <Folder size={16} className="text-fg-2" aria-hidden />
        History
      </span>
      <div className="flex items-center gap-3">
        <div className="flex h-9 items-center gap-2 rounded-[10px] bg-page-2 px-1">
          <ZoomSlider />
          <ViewToggle />
        </div>
        <FilterPopover activeCount={countActiveFilters(filters)} />
      </div>
    </div>
  )
}
