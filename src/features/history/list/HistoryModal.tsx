'use client'

import { type ReactNode, useCallback, useEffect, useRef } from 'react'
import { isEmpty, isNil } from 'lodash-es'
import { useShallow } from 'zustand/react/shallow'

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
import { useHistoryViewerStore } from './history-viewer-store'

interface HistoryModalProps {
  record: GenerationRecord | null
  viewOrder: string[]
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  toolbar?: (record: GenerationRecord) => ReactNode
}

interface HistoryNavParams {
  selectedId: string | null
  viewOrder: string[]
  hasMore: boolean
  isLoadingMore: boolean
  navigate: (id: string) => void
  onLoadMore: () => void
  close: () => void
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

function handleOpenChange(isNextOpen: boolean): void {
  if (!isNextOpen) {
    useHistoryViewerStore.getState().close()
  }
}

interface RecordToolbarParams {
  record: GenerationRecord | null
  render: ((record: GenerationRecord) => ReactNode) | undefined
}

/** Toolbar node for a completed record, null while it is still running or failed. */
function recordToolbar(params: RecordToolbarParams): ReactNode {
  const { record, render } = params

  if (isNil(render) || isNil(record) || record.status !== 'completed') {
    return null
  }

  return render(record)
}

/** Record position in the view order, paging and delete recovery. */
function useHistoryNav(params: HistoryNavParams) {
  const { selectedId, viewOrder, hasMore, isLoadingMore, navigate, onLoadMore, close } = params

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
      close()

      return
    }

    const nextId = viewOrder[Math.min(lastIndexRef.current, viewOrder.length - 1)]

    if (!isNil(nextId) && nextId !== selectedId) {
      navigate(nextId)
    }
  }, [close, index, navigate, selectedId, viewOrder])

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
      navigate(previousId)
    }
  }, [index, navigate, viewOrder])

  const handleNext = useCallback(() => {
    const nextId = viewOrder[index + 1]

    if (index < viewOrder.length - 1 && !isNil(nextId)) {
      navigate(nextId)

      return
    }

    if (hasMore) {
      onLoadMore()
    }
  }, [hasMore, index, navigate, onLoadMore, viewOrder])

  return {
    hasPrevious: index > 0,
    hasNext: index >= 0 && (index < viewOrder.length - 1 || hasMore),
    onPrevious: handlePrevious,
    onNext: handleNext,
  }
}

/** Viewer state with stable action references. */
function useHistoryViewer() {
  return useHistoryViewerStore(
    useShallow((state) => {
      return { selectedId: state.selectedId, navigate: state.navigate, close: state.close }
    }),
  )
}

/** Centered grid preview: 16:9 player left, details panel right, record navigation. */
export function HistoryModal(props: HistoryModalProps) {
  const { record, viewOrder, hasMore, isLoadingMore } = props
  const { selectedId, navigate, close } = useHistoryViewer()

  const isOpen = !isNil(selectedId)
  const backdropPoster = recordPoster(record)

  const nav = useHistoryNav({
    selectedId,
    viewOrder,
    hasMore,
    isLoadingMore,
    navigate,
    onLoadMore: props.onLoadMore,
    close,
  })

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

  const toolbar = recordToolbar({ record, render: props.toolbar })

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      label="Video details"
      backdropClassName="bg-black/80"
      className="h-[calc(100vh-48px)] max-h-275 w-[calc(100vw-48px)] max-w-450 overflow-hidden bg-page-2 p-3"
    >
      {!isNil(record) && (
        <div ref={scopeRef} className="flex h-full min-h-0 flex-col gap-3 compact:flex-row">
          <div className="flex min-h-[50vh] min-w-0 flex-1 compact:min-h-0">
            <MediaStage
              backdrop={stageBackdrop(record, backdropPoster)}
              nav={nav}
              toolbar={toolbar}
            >
              {record.status === 'completed' && (
                <MediaBox aspect={recordAspect(record)}>
                  <LazyVideo
                    key={record.id}
                    id={`modal-${record.id}`}
                    src={videoSrc(record)}
                    poster={posterSrc(record, 1280)}
                    posterFit="contain"
                    videoFit="contain"
                    seekKeys="shiftArrows"
                    autoPlay
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
