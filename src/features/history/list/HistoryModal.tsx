'use client'

import { useEffect, useRef } from 'react'
import { isEmpty, isNil } from 'lodash-es'

import { DETAILS_MIN_WIDTH } from '@/core/constants'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { LazyVideo } from '@/features/player/LazyVideo'
import { preloadPosters } from '@/lib/preload-posters'
import { MediaStage } from '@/ui/MediaStage'
import { Modal } from '@/ui/Modal'

import { cancelGeneration } from '../actions/record-actions'
import { posterSrc, videoSrc } from '../actions/record-view'
import { DetailsPanel } from '../details/DetailsPanel'
import { StatusOverlay } from '../status/StatusOverlay'

interface HistoryModalProps {
  record: GenerationRecord | null
  open: boolean
  selectedId: string | null
  order: string[]
  hasMore: boolean
  isLoadingMore: boolean
  onNavigate: (id: string) => void
  onLoadMore: () => void
  onOpenChange: (open: boolean) => void
}

interface HistoryNavParams {
  selectedId: string | null
  order: string[]
  hasMore: boolean
  isLoadingMore: boolean
  onNavigate: (id: string) => void
  onLoadMore: () => void
  onOpenChange: (open: boolean) => void
}

function recordPoster(record: GenerationRecord | null): string | undefined {
  if (isNil(record)) {
    return undefined
  }

  return posterSrc(record, 64)
}

/** Blurred backdrop: the record thumb when it has one, else its id gradient. */
function stageBackdrop(record: GenerationRecord, poster: string | undefined) {
  if (isNil(poster)) {
    return { kind: 'gradient' as const, seed: record.id }
  }

  return { kind: 'image' as const, src: poster }
}

/** Record position in the loaded order, paging and delete recovery. */
function useHistoryNav(params: HistoryNavParams) {
  const { selectedId, order, hasMore, isLoadingMore, onNavigate, onLoadMore, onOpenChange } = params
  let index = -1

  if (!isNil(selectedId)) {
    index = order.indexOf(selectedId)
  }

  const lastIndexRef = useRef(0)

  useEffect(() => {
    if (index >= 0) {
      lastIndexRef.current = index
    }
  }, [index])

  // A delete removes the record from order. Pick the id now at its old slot.
  useEffect(() => {
    if (isNil(selectedId) || index !== -1) {
      return
    }

    if (isEmpty(order)) {
      onOpenChange(false)

      return
    }

    const nextId = order[Math.min(lastIndexRef.current, order.length - 1)]

    if (!isNil(nextId) && nextId !== selectedId) {
      onNavigate(nextId)
    }
  }, [index, onNavigate, onOpenChange, order, selectedId])

  useEffect(() => {
    if (index < 0 || !hasMore || isLoadingMore) {
      return
    }

    if (index >= order.length - 3) {
      onLoadMore()
    }
  }, [hasMore, index, isLoadingMore, onLoadMore, order.length])

  const handlePrevious = () => {
    const previousId = order[index - 1]

    if (index > 0 && !isNil(previousId)) {
      onNavigate(previousId)
    }
  }

  const handleNext = () => {
    const nextId = order[index + 1]

    if (index < order.length - 1 && !isNil(nextId)) {
      onNavigate(nextId)

      return
    }

    if (hasMore) {
      onLoadMore()
    }
  }

  return {
    hasPrevious: index > 0,
    hasNext: index >= 0 && (index < order.length - 1 || hasMore),
    onPrevious: handlePrevious,
    onNext: handleNext,
  }
}

/** Centered grid preview: 16:9 player left, details panel right, record navigation. */
export function HistoryModal(props: HistoryModalProps) {
  const { record, open: isOpen } = props
  const backdropPoster = recordPoster(record)
  const nav = useHistoryNav(props)

  useEffect(() => {
    preloadPosters([backdropPoster])
  }, [backdropPoster])

  const handleCancel = () => {
    if (isNil(record)) {
      return
    }

    void cancelGeneration(record.id)
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={props.onOpenChange}
      label="Video details"
      backdropClassName="bg-black/80"
      className="h-[calc(100vh-48px)] max-h-275 w-[calc(100vw-48px)] max-w-450 overflow-hidden bg-page-2 p-3"
    >
      {!isNil(record) && (
        <div className="flex h-full min-h-0 flex-col gap-3 compact:flex-row">
          <div className="flex min-h-[50vh] min-w-0 flex-1 compact:min-h-0">
            <MediaStage backdrop={stageBackdrop(record, backdropPoster)} nav={nav}>
              {record.status === 'completed' && (
                <LazyVideo
                  id={`modal-${record.id}`}
                  src={videoSrc(record)}
                  poster={posterSrc(record, 1280)}
                  posterFit="contain"
                  videoFit="contain"
                  seekKeys="shiftArrows"
                  className="size-full"
                />
              )}
              {record.status !== 'completed' && (
                <div className="w-full max-w-2xl">
                  <StatusOverlay record={record} fill onCancel={handleCancel} />
                </div>
              )}
            </MediaStage>
          </div>
          <div
            className="group/card min-h-0 w-80 shrink-0 overflow-hidden"
            style={{ minWidth: DETAILS_MIN_WIDTH }}
          >
            <DetailsPanel record={record} />
          </div>
        </div>
      )}
    </Modal>
  )
}
