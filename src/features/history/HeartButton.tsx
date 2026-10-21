'use client'

import { Heart } from 'lucide-react'
import type { GenerationRecord } from '@/core/types'
import { toggleFavorite } from './record-actions'
import { cn } from '@/lib/cn'

const ROUND =
  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 backdrop-blur transition-colors'

interface HeartButtonProps {
  record: GenerationRecord
  className?: string
}

/** Circular heart toggle: pink gradient when liked, neutral glass when not. */
export function HeartButton(props: HeartButtonProps) {
  const { record, className } = props
  return (
    <button
      type="button"
      aria-label={record.favorite ? 'Remove favorite' : 'Favorite'}
      onClick={(event) => {
        event.stopPropagation()
        void toggleFavorite(record)
      }}
      className={cn(
        ROUND,
        record.favorite
          ? 'bg-linear-[180deg] from-favorite/[0.22] to-favorite/[0.08] text-favorite'
          : 'bg-black/50 text-white hover:bg-black/70',
        className,
      )}
    >
      <Heart size={15} className={cn(record.favorite && 'fill-current')} aria-hidden />
    </button>
  )
}
