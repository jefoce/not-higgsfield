'use client'

import { useSelectionStore } from './selection-store'

/** Selection state and click handling for one card. */
export function useSelectionItem(id: string): {
  selected: boolean
  selecting: boolean
  selectable: boolean
  select: (shift: boolean) => void
} {
  const selected = useSelectionStore((state) => state.ids.has(id))
  const selecting = useSelectionStore((state) => state.ids.size > 0)
  const selectable = useSelectionStore((state) => state.order.includes(id))
  const toggle = useSelectionStore((state) => state.toggle)
  const selectRange = useSelectionStore((state) => state.selectRange)

  const select = (shift: boolean) => {
    if (shift) selectRange(id)
    else toggle(id)
  }

  return { selected, selecting, selectable, select }
}
