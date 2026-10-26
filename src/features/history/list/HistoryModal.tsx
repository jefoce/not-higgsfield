'use client'

import { useCallback, useEffect, useRef } from 'react'
import { isEmpty, isNil } from 'lodash-es'

import { DETAILS_MIN_WIDTH } from '@/core/constants'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import { LazyVideo } from '@/features/player/LazyVideo'
import { preloadPosters } from '@/lib/preload-posters'
import { useChainKeys } from '@/lib/use-chain-keys'
import { MediaBox } from '@/ui/MediaBox'
import { MediaStage } from '@/ui/MediaStage'
import { Modal } from '@/ui/Modal'

import { cancelGeneration } from '../actions/record-actions'
import { posterSrc, recordAspect, videoSrc } from '../actions/record-view'
import { DetailsPanel } from '../details/DetailsPanel'
import { StatusOverlay } from '../status/StatusOverlay'

interface HistoryModalProps {
  record: GenerationRecord | null
  open: boolean
  selectedId: string | null
  viewOrder: string[]
  hasMore: boolean
  isLoadingMore: boolean
  onNavigate: (id: string) => void
  onLoadMore: () => void
  onOpenChange: (open: boolean) => void
}

interface HistoryNavParams {
  selectedId: string | null
  viewOrder: string[]
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

/** Record position in the view order, paging and delete recovery. */
function useHistoryNav(params: HistoryNavParams) {
  const { selectedId, viewOrder, hasMore, isLoadingMore, onNavigate, onLoadMore, onOpenChange } =
    params

  let index = -1

  if (!isNil(selectedId)) {
    index = viewOrder.indexOf(selectedId)
  }

  const lastIndexRef = useRef(0)

  useEffect(() => {
    if (index >= 0) {
      lastIndexRef.current = index
    }
  }, [index])

  // A delete removes the record from viewOrder. Pick the id now at its old slot.
  useEffect(() => {
    if (isNil(selectedId) || index !== -1) {
      return
    }

    if (isEmpty(viewOrder)) {
      onOpenChange(false)

      return
    }

    const nextId = viewOrder[Math.min(lastIndexRef.current, viewOrder.length - 1)]

    if (!isNil(nextId) && nextId !== selectedId) {
      onNavigate(nextId)
    }
  }, [index, onNavigate, onOpenChange, selectedId, viewOrder])

  useEffect(() => {
    if (index < 0 || !hasMore || isLoadingMore) {
      return
    }

    if (index >= viewOrder.length - 3) {
      onLoadMore()
    }
  }, [hasMore, index, isLoadingMore, onLoadMore, viewOrder.length])

  const handlePrevious = useCallback(() => {
    const previousId = viewOrder[index - 1]

    if (index > 0 && !isNil(previousId)) {
      onNavigate(previousId)
    }
  }, [index, onNavigate, viewOrder])

  const handleNext = useCallback(() => {
    const nextId = viewOrder[index + 1]

    if (index < viewOrder.length - 1 && !isNil(nextId)) {
      onNavigate(nextId)

      return
    }

    if (hasMore) {
      onLoadMore()
    }
  }, [hasMore, index, onLoadMore, onNavigate, viewOrder])

  return {
    hasPrevious: index > 0,
    hasNext: index >= 0 && (index < viewOrder.length - 1 || hasMore),
    onPrevious: handlePrevious,
    onNext: handleNext,
  }
}

/** Centered grid preview: 16:9 player left, details panel right, record navigation. */
export function HistoryModal(props: HistoryModalProps) {
  const { record, open: isOpen } = props
  const backdropPoster = recordPoster(record)
  const nav = useHistoryNav(props)
  const scopeRef = useRef<HTMLDivElement>(null)

  useChainKeys({
    isEnabled: isOpen,
    onPrevious: nav.onPrevious,
    onNext: nav.onNext,
    scopeRef,
  })

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
        <div ref={scopeRef} className="flex h-full min-h-0 flex-col gap-3 compact:flex-row">
          <div className="flex min-h-[50vh] min-w-0 flex-1 compact:min-h-0">
            <MediaStage backdrop={stageBackdrop(record, backdropPoster)} nav={nav}>
              {record.status === 'completed' && (
                <MediaBox aspect={recordAspect(record)}>
                  <LazyVideo
                    id={`modal-${record.id}`}
                    src={videoSrc(record)}
                    poster={posterSrc(record, 1280)}
                    posterFit="contain"
                    videoFit="contain"
                    seekKeys="shiftArrows"
                    className="size-full"
                  />
                </MediaBox>
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
