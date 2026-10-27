'use client'

import { Plus } from 'lucide-react'
import type { MouseEvent } from 'react'

interface AddReferenceTileProps {
  onPick: (element: HTMLElement) => void
}

/** Grid cell for adding more references. */
export function AddReferenceTile(props: AddReferenceTileProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    props.onPick(event.currentTarget)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Add references"
      className="flex aspect-square items-center justify-center rounded-xl border border-transparent bg-surface-2 text-fg-2 hover:bg-white/8"
    >
      <Plus size={18} />
    </button>
  )
}
