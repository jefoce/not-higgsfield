'use client'

import { useEffect, useRef, useState } from 'react'
import { DETAILS_MIN_WIDTH, ROW_MIN_HEIGHT } from '@/core/constants'
import type { GenerationRecord } from '@/core/types'
import { LazyVideo } from '@/features/player/LazyVideo'
import { isOwnEvent } from '@/lib/events'
import { CardActions } from './CardActions'
import { DetailsPanel } from './DetailsPanel'
import { SelectionCheckbox } from './SelectionCheckbox'
import { useSelectionItem } from './use-selection-item'
import { listVideoShare, useHistoryViewStore } from './view-store'
import { cancelGeneration } from './record-actions'
import { isSelectable, posterSrc, videoSrc } from './record-view'
import { StatusOverlay } from './StatusOverlay'

const MEDIA_ASPECT = '16 / 9'

interface HistoryRowProps {
  record: GenerationRecord
}

/** List row: 16:9 media left, details right; both scale with the row width. */
export function HistoryRow(props: HistoryRowProps) {
  const { record } = props
  const completed = record.status === 'completed'
  const zoom = useHistoryViewStore((state) => state.zoom)
  const videoShare = listVideoShare(zoom)
  const mediaRef = useRef<HTMLDivElement>(null)
  const [mediaWidth, setMediaWidth] = useState(0)
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const posterWidth = mediaWidth ? Math.ceil((mediaWidth * dpr) / 80) * 80 : undefined
  const poster = posterSrc(record, posterWidth)
  const { selected, selecting, select } = useSelectionItem(record.id)
  const selectable = isSelectable(record)

  useEffect(() => {
    const node = mediaRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setMediaWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className="group/card flex w-full items-stretch gap-3"
      style={{
        minHeight: ROW_MIN_HEIGHT,
        contentVisibility: 'auto',
        containIntrinsicSize: `auto ${ROW_MIN_HEIGHT}px`,
      }}
    >
      <div
        ref={mediaRef}
        onClick={(event) => {
          if (!isOwnEvent(event)) return
          if ((event.target as HTMLElement).closest('button, a, input')) return
          if (event.shiftKey) {
            if (selectable) select(true)
            return
          }
          if (selecting && !selected && selectable) select(false)
        }}
        className="relative shrink-0 cursor-default select-none self-start overflow-hidden rounded-2xl bg-surface"
        style={{
          width: `${videoShare * 100}%`,
          maxWidth: `calc(100% - ${DETAILS_MIN_WIDTH}px - 0.75rem)`,
          aspectRatio: MEDIA_ASPECT,
        }}
      >
        {!!completed && <SelectionCheckbox id={record.id} />}

        {completed ? (
          <LazyVideo
            id={record.id}
            src={videoSrc(record)}
            poster={poster}
            posterFit="cover"
            videoFit="contain"
            interactive={!selecting || selected}
            className="h-full w-full"
          />
        ) : (
          <StatusOverlay
            record={record}
            fill
            onCancel={() => void cancelGeneration(record.id)}
          />
        )}

        {!!selected && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-2 border-white"
          />
        )}

        {!!completed && !selecting && <CardActions record={record} className="top-3" pinHeart />}
      </div>

      <div
        className="min-h-0 flex-1 self-stretch overflow-hidden"
        style={{ minWidth: DETAILS_MIN_WIDTH }}
      >
        <DetailsPanel record={record} />
      </div>
    </div>
  )
}
