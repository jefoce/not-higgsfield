'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SegmentedTabOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface SegmentedTabsProps {
  options: SegmentedTabOption[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  size?: 'sm' | 'md'
}

/** Controlled segmented tab control. */
export function SegmentedTabs(props: SegmentedTabsProps) {
  const { options, value, onValueChange, className, size = 'md' } = props
  const sizeClass = size === 'md' ? 'h-10 text-sm' : 'h-8 text-xs'

  return (
    <div
      role="tablist"
      className={cn('grid gap-0 rounded-xl bg-surface', className)}
      style={{ gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'relative inline-flex items-center justify-center rounded-[10px] font-semibold transition',
              'disabled:pointer-events-none disabled:opacity-40',
              sizeClass,
              active ? 'text-fg' : 'text-fg-2 hover:text-fg',
            )}
          >
            {!!active && (
              <span className="absolute inset-0.5 rounded-[10px] bg-white/10" aria-hidden />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
