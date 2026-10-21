'use client'

import { Download } from 'lucide-react'
import type { GenerationRecord } from '@/core/types'
import { cn } from '@/lib/cn'
import { HeartButton } from './HeartButton'
import { saveRecordVideo } from './record-actions'
import { MoreMenu } from './MoreMenu'

const ROUND =
  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70'

const HIDDEN =
  'pointer-events-none opacity-0 transition-opacity group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-[:focus-visible]/card:pointer-events-auto group-has-[:focus-visible]/card:opacity-100 has-[[data-state=open]]:pointer-events-auto has-[[data-state=open]]:opacity-100'

interface CardActionsProps {
  record: GenerationRecord
  className?: string
  /** Keep the liked heart visible without hover, for the list stack. */
  pinHeart?: boolean
}

/** Heart, download and menu stack shared by the list row and grid tile. */
export function CardActions(props: CardActionsProps) {
  const { record, className, pinHeart = false } = props
  const pinned = pinHeart && record.favorite
  return (
    <div className={cn('absolute right-3 flex flex-col gap-1.5', className)}>
      <HeartButton record={record} className={cn(!pinned && HIDDEN)} />
      <button
        type="button"
        aria-label="Download"
        onClick={(event) => {
          event.stopPropagation()
          void saveRecordVideo(record)
        }}
        className={cn(ROUND, HIDDEN)}
      >
        <Download size={15} aria-hidden />
      </button>
      <MoreMenu record={record} className={HIDDEN} />
    </div>
  )
}
