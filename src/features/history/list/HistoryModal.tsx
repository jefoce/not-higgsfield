'use client'

import { useEffect } from 'react'
import { isNil } from 'lodash-es'

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
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
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

/** Centered grid preview: 16:9 player left, details panel right. */
export function HistoryModal(props: HistoryModalProps) {
  const { record, open: isOpen } = props
  const backdropPoster = recordPoster(record)

  useEffect(() => {
    preloadPosters([backdropPoster])
  }, [backdropPoster])

  const handleCancel = () => {
    if (isNil(record)) {
      return
    }

    void cancelGeneration(record.id)
  }

  const handleDeleted = () => {
    props.onOpenChange(false)
    props.onDeleted?.()
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
            <MediaStage backdrop={stageBackdrop(record, backdropPoster)}>
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
            <DetailsPanel record={record} onDeleted={handleDeleted} />
          </div>
        </div>
      )}
    </Modal>
  )
}
