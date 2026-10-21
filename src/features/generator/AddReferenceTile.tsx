'use client'

import { Plus } from 'lucide-react'

interface AddReferenceTileProps {
  onPick: () => void
}

/** Grid cell for adding more references. */
export function AddReferenceTile(props: AddReferenceTileProps) {
  const { onPick } = props
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label="Add references"
      className="flex aspect-square items-center justify-center rounded-xl border border-transparent bg-surface-2 text-fg-2 hover:bg-white/[0.08]"
    >
      <Plus size={18} />
    </button>
  )
}
