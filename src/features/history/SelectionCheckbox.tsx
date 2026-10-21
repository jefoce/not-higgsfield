'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSelectionItem } from './use-selection-item'

interface SelectionCheckboxProps {
  id: string
  className?: string
}

/** Inline checkbox for a card's media area. */
export function SelectionCheckbox(props: SelectionCheckboxProps) {
  const { id, className } = props
  const { selected, selecting, selectable, select } = useSelectionItem(id)

  if (!selectable) return null

  return (
    <span
      onMouseDown={(event) => event.stopPropagation()}
      className={cn(
        'absolute left-3 top-3 z-30 transition-opacity',
        selecting
          ? 'opacity-100'
          : 'pointer-events-none opacity-0 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-[:focus-visible]/card:pointer-events-auto group-has-[:focus-visible]/card:opacity-100',
        className,
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label="Select video"
        onClick={(event) => {
          event.stopPropagation()
          select(event.shiftKey)
        }}
        onKeyDown={(event) => {
          if (event.key !== ' ') return
          event.preventDefault()
          select(event.shiftKey)
        }}
        className={cn(
          'flex size-5 items-center justify-center rounded-md transition-colors',
          selected
            ? 'border-[1.5px] border-white bg-white text-black'
            : 'border-[1.5px] border-white/90 bg-black/20 hover:bg-black/40',
        )}
      >
        {Boolean(selected) && <Check size={12} strokeWidth={3} aria-hidden />}
      </button>
    </span>
  )
}
