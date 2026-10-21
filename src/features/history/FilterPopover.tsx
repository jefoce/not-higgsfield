'use client'

import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { debounce, uniq } from 'lodash-es'
import { MODEL_PRESETS, RESOLUTIONS, type AspectChoice, type Resolution } from '@/core/presets'
import { cn } from '@/lib/cn'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { SearchInput } from '@/ui/form/SearchInput'
import { useHistoryViewStore, type HistoryMode } from './view-store'

interface FilterPopoverProps {
  activeCount: number
}

interface ChoiceProps<T extends string> {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}

function Choice<T extends string>(props: ChoiceProps<T>) {
  const { label, value, options, onChange } = props
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-fg-2">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-8 rounded-lg px-2 text-sm transition',
              option.value === value ? 'bg-white/10 text-fg' : 'text-fg-2 hover:bg-hover hover:text-fg',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'active', label: 'In progress' },
  { value: 'failed', label: 'Failed' },
] as const

const MODE_OPTIONS: readonly { value: HistoryMode; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'text', label: 'Text' },
  { value: 'frames', label: 'Frames' },
  { value: 'references', label: 'References' },
]

const RESOLUTION_OPTIONS: readonly { value: Resolution | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...RESOLUTIONS.map((value) => ({ value, label: value })),
]

const ASPECT_OPTIONS: readonly { value: AspectChoice | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'auto', label: 'Auto' },
  ...uniq(MODEL_PRESETS.flatMap((preset) => preset.aspectRatios)).map((value) => ({
    value,
    label: value,
  })),
]

const AUDIO_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
] as const

/** Filter button with prompt search, favorites, status, mode and presets. */
export function FilterPopover(props: FilterPopoverProps) {
  const { activeCount } = props
  const filters = useHistoryViewStore((state) => state.filters)
  const setFilters = useHistoryViewStore((state) => state.setFilters)
  const resetFilters = useHistoryViewStore((state) => state.resetFilters)
  const [query, setQuery] = useState(filters.q ?? '')

  const commitQuery = useMemo(
    () => debounce((value: string) => setFilters({ q: value.trim() || undefined }), 250),
    [setFilters],
  )

  useEffect(() => () => commitQuery.cancel(), [commitQuery])

  const reset = () => {
    commitQuery.cancel()
    setQuery('')
    resetFilters()
  }

  return (
    // Multi-toggle panel: stays open until click outside or Escape.
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-veil px-3 py-1 text-sm font-medium text-fg-2 transition hover:bg-surface-2 hover:text-fg"
        >
          <SlidersHorizontal size={16} aria-hidden />
          Filter
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-semibold text-on-lime">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <SearchInput
          id="history-filter-search"
          name="q"
          aria-label="Search prompts"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            commitQuery(event.target.value)
          }}
          placeholder="Search prompt"
        />
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(filters.favorite)}
          onClick={() => setFilters({ favorite: filters.favorite ? undefined : true })}
          className="flex w-full items-center justify-between px-1 text-xs text-fg-2 transition hover:text-fg"
        >
          Favorites only
          <span className={cn('relative h-4 w-7 rounded-full transition-colors', filters.favorite ? 'bg-lime' : 'bg-white/15')}>
            <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-page transition-transform', filters.favorite ? 'left-3.5' : 'left-0.5')} />
          </span>
        </button>
        <Choice
          label="Status"
          value={filters.status ?? 'all'}
          options={STATUS_OPTIONS}
          onChange={(status) => setFilters({ status })}
        />
        <Choice
          label="Mode"
          value={filters.mode ?? 'all'}
          options={MODE_OPTIONS}
          onChange={(mode) =>
            setFilters({ mode, tab: mode === 'frames' || mode === 'references' ? mode : 'all' })
          }
        />
        <Choice
          label="Model"
          value={filters.model ?? 'all'}
          options={[
            { value: 'all', label: 'All' },
            ...MODEL_PRESETS.map((preset) => ({ value: preset.id, label: preset.title })),
          ]}
          onChange={(model) => setFilters({ model })}
        />
        <Choice
          label="Resolution"
          value={filters.resolution ?? 'all'}
          options={RESOLUTION_OPTIONS}
          onChange={(resolution) => setFilters({ resolution })}
        />
        <Choice
          label="Aspect"
          value={filters.aspect ?? 'all'}
          options={ASPECT_OPTIONS}
          onChange={(aspect) => setFilters({ aspect })}
        />
        <Choice
          label="Audio"
          value={filters.audio ?? 'any'}
          options={AUDIO_OPTIONS}
          onChange={(audio) => setFilters({ audio })}
        />
        <div className="flex justify-end border-t border-divider pt-2">
          <button
            type="button"
            onClick={reset}
            className="text-xs text-fg-2 transition hover:text-fg"
          >
            Reset
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
