'use client'

import { Grid2x2, List } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useHistoryViewStore, type HistoryView } from './view-store'

const OPTIONS: { value: HistoryView; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
]

const ICONS = { list: List, grid: Grid2x2 }

/** List and grid switch for the history feed. */
export function ViewToggle() {
  const view = useHistoryViewStore((state) => state.view)
  const setView = useHistoryViewStore((state) => state.setView)

  return (
    <div
      role="tablist"
      aria-label="View"
      className="flex h-9 items-center gap-1 rounded-lg bg-page-2 p-0.5"
    >
      {OPTIONS.map((option) => {
        const Icon = ICONS[option.value]
        const active = option.value === view
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setView(option.value)}
            className={cn(
              'inline-flex h-8 w-16 items-center justify-center gap-1.5 rounded-lg border border-transparent text-xs font-semibold transition',
              active ? 'bg-surface text-fg' : 'text-fg-2 hover:text-fg',
            )}
          >
            <Icon size={14} aria-hidden />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
