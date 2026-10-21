'use client'

import { GRID_TILE_ASPECT } from '@/core/constants'
import type { GenerationRecord } from '@/core/types'
import { LazyVideo } from '@/features/player/LazyVideo'
import { isOwnEvent } from '@/lib/events'
import { CardActions } from './CardActions'
import { FavoriteBadge } from './FavoriteBadge'
import { SelectionCheckbox } from './SelectionCheckbox'
import { useSelectionItem } from './use-selection-item'
import { StatusOverlay } from './StatusOverlay'
import { cancelGeneration } from './record-actions'
import { isSelectable, posterSrc, videoSrc } from './record-view'
import { useHistoryViewStore, zoomToGridColumns, zoomToTileWidth } from './view-store'

interface HistoryTileProps {
  record: GenerationRecord
  onOpen: (record: GenerationRecord) => void
}

/** Grid tile: hover plays a muted loop, actions replace the liked badge. */
export function HistoryTile(props: HistoryTileProps) {
  const { record, onOpen } = props
  const completed = record.status === 'completed'
  const zoom = useHistoryViewStore((state) => state.zoom)
  const tileWidth = zoomToTileWidth(zoom)
  const compact = zoomToGridColumns(zoom) >= 7 // dense rows shrink the status pill
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const poster = posterSrc(record, Math.ceil((tileWidth * dpr) / 80) * 80)
  const { selected, selecting, select } = useSelectionItem(record.id)
  const selectable = isSelectable(record)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={selecting ? 'Toggle selection' : 'Open video details'}
      onClick={(event) => {
        if (!isOwnEvent(event)) return
        if ((event.target as HTMLElement).closest('button, a, input')) return
        if ((event.shiftKey || selecting) && !selectable) return
        if (event.shiftKey || selecting) select(event.shiftKey)
        else onOpen(record)
      }}
      onKeyDown={(event) => {
        if (!isOwnEvent(event)) return
        if (event.target !== event.currentTarget) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        if ((event.shiftKey || selecting) && !selectable) return
        if (event.shiftKey || selecting) select(event.shiftKey)
        else onOpen(record)
      }}
      className="group/card relative cursor-pointer select-none overflow-hidden rounded-2xl bg-surface outline-none"
      style={{
        aspectRatio: GRID_TILE_ASPECT,
        contentVisibility: 'auto',
        containIntrinsicSize: `auto ${tileWidth}px`,
      }}
    >
      {!!completed && <SelectionCheckbox id={record.id} />}

      {completed ? (
        <LazyVideo
          id={record.id}
          src={videoSrc(record)}
          poster={poster}
          posterFit="cover"
          videoFit="cover"
          hoverPlay
          className="h-full w-full"
        />
      ) : (
        <div className="h-full w-full">
          <StatusOverlay
            record={record}
            boxAspect={GRID_TILE_ASPECT}
            compact={compact}
            onCancel={() => void cancelGeneration(record.id)}
          />
        </div>
      )}

      {!!selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-2 border-white"
        />
      )}

      {!!completed && !selecting && <>
          <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)] opacity-0 transition-opacity duration-300 ease-out group-hover/card:opacity-100 group-has-[:focus-visible]/card:opacity-100" />
          {!!record.favorite && <FavoriteBadge record={record} />}
          <CardActions record={record} className="top-3 z-20" />
        </>}
    </div>
  )
}
