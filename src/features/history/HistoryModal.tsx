'use client'

import { DETAILS_MIN_WIDTH } from '@/core/constants'
import type { GenerationRecord } from '@/core/types'
import { LazyVideo } from '@/features/player/LazyVideo'
import { Modal } from '@/ui/Modal'
import { DetailsPanel } from './DetailsPanel'
import { StatusOverlay } from './StatusOverlay'
import { cancelGeneration } from './record-actions'
import { posterSrc, videoSrc } from './record-view'

interface HistoryModalProps {
  record: GenerationRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

/** Centered grid preview: 16:9 player left, details panel right. */
export function HistoryModal(props: HistoryModalProps) {
  const { record, open, onOpenChange, onDeleted } = props
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      label="Video details"
      className="h-[min(80vh,820px)] w-[min(1100px,92vw)] overflow-hidden bg-surface p-3"
    >
      {record != null && (
        <div className="flex h-full min-h-0 gap-3">
          <div className="relative aspect-video w-full min-w-0 flex-1 self-center overflow-hidden rounded-2xl bg-black">
            {record.status === 'completed' ? (
              <LazyVideo
                id={`modal-${record.id}`}
                src={videoSrc(record)}
                poster={posterSrc(record, 1280)}
                posterFit="contain"
                videoFit="contain"
                className="h-full w-full"
              />
            ) : (
              <StatusOverlay
                record={record}
                fill
                onCancel={() => void cancelGeneration(record.id)}
              />
            )}
          </div>
          <div
            className="group/card min-h-0 w-[280px] shrink-0 overflow-hidden"
            style={{ minWidth: DETAILS_MIN_WIDTH }}
          >
            <DetailsPanel
              record={record}
              onDeleted={() => {
                onOpenChange(false)
                onDeleted?.()
              }}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
