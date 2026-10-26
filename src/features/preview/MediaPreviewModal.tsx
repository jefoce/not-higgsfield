'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isNil } from 'lodash-es'

import { usePlayerSlot } from '@/features/player/use-player-slot'
import { thumbUrl } from '@/lib/api/media-urls'
import { preloadPosters } from '@/lib/preload-posters'
import { useChainKeys } from '@/lib/use-chain-keys'
import { MediaStage } from '@/ui/MediaStage'
import { Modal } from '@/ui/Modal'

import { type ActionKey, closePreview, type PreviewItem, usePreviewStore } from './preview-store'
import { PreviewBody } from './PreviewBody'
import { PreviewFooter } from './PreviewFooter'
import { PreviewHeader } from './PreviewHeader'

/** 64 px thumb the stage blurs behind an image or video, undefined otherwise. */
function stagePoster(item: PreviewItem | undefined): string | undefined {
  if (isNil(item) || item.missing === true) {
    return undefined
  }

  if (item.kind !== 'image' && item.kind !== 'video') {
    return undefined
  }

  const ref = item.previewRef ?? `uploads/${item.id}`

  return thumbUrl({ ref, w: 64 })
}

function stageBackdrop(item: PreviewItem | undefined, poster: string | undefined) {
  if (isNil(poster)) {
    return { kind: 'gradient' as const, seed: item?.id ?? 'missing' }
  }

  return { kind: 'image' as const, src: poster }
}

function handleOpenChange(isOpen: boolean): void {
  if (!isOpen) {
    closePreview()
  }
}

/** Full-size media preview with header, navigation and opener actions. */
export function MediaPreviewModal() {
  const request = usePreviewStore((state) => {
    return state.request
  })

  const [lastRequest, setLastRequest] = useState(request)
  const [index, setIndex] = useState(request?.index ?? 0)
  const { acquire, release } = usePlayerSlot()
  const scopeRef = useRef<HTMLDivElement>(null)

  if (request !== lastRequest) {
    setLastRequest(request)
    setIndex(request?.index ?? 0)
  }

  const items = request?.items ?? []
  const item = items.at(index)
  const playerId = item ? `preview:${item.id}` : ''

  useEffect(() => {
    if (item?.kind !== 'video') {
      return
    }

    acquire(playerId)

    return () => {
      release(playerId)
    }
  }, [acquire, item, playerId, release])

  useEffect(() => {
    const list = request?.items ?? []

    preloadPosters([stagePoster(list[index - 1]), stagePoster(list[index + 1])])
  }, [index, request])

  const backdropPoster = stagePoster(item)

  const handleRun = (key: ActionKey) => {
    const action = request?.actions?.[key]

    if (!action || !item) {
      return
    }

    closePreview() // close first so an opener action cannot stack modals
    action(item)
  }

  const handlePrev = useCallback(() => {
    setIndex((current) => {
      return Math.max(0, current - 1)
    })
  }, [])

  const handleNext = useCallback(() => {
    setIndex((current) => {
      return Math.min(items.length - 1, current + 1)
    })
  }, [items.length])

  useChainKeys({ isEnabled: !isNil(request), onPrevious: handlePrev, onNext: handleNext, scopeRef })

  if (!request) {
    return null
  }

  return (
    <Modal
      open
      onOpenChange={handleOpenChange}
      label="Media preview"
      backdropClassName="bg-black/80"
      className="flex h-[calc(100vh-48px)] max-h-275 w-[calc(100vw-48px)] max-w-450 flex-col overflow-hidden bg-page-2 p-0"
    >
      <div ref={scopeRef} className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <PreviewHeader item={item} actions={request.actions} />

        <MediaStage
          backdrop={stageBackdrop(item, backdropPoster)}
          nav={{
            hasPrevious: index > 0,
            hasNext: index < items.length - 1,
            onPrevious: handlePrev,
            onNext: handleNext,
          }}
        >
          <PreviewBody item={item} playerId={playerId} seekKeys="shiftArrows" />
        </MediaStage>

        <PreviewFooter item={item} actions={request.actions} onRun={handleRun} />
      </div>
    </Modal>
  )
}
