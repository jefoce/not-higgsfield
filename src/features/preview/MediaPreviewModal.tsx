'use client'

import { useCallback, useEffect, useState } from 'react'

import { usePlayerSlot } from '@/features/player/use-player-slot'
import { useChainKeys } from '@/lib/use-chain-keys'
import { Modal } from '@/ui/Modal'
import { StageNavButton } from '@/ui/StageNavButton'

import { type ActionKey, closePreview, usePreviewStore } from './preview-store'
import { PreviewBody } from './PreviewBody'
import { PreviewFooter } from './PreviewFooter'
import { PreviewHeader } from './PreviewHeader'

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

  const handleRun = (key: ActionKey) => {
    const action = request?.actions?.[key]

    if (!action || !item) {
      return
    }

    closePreview() // close first so an opener action cannot stack modals
    action(item)
  }

  const handlePrevious = useCallback(() => {
    setIndex((current) => {
      return Math.max(0, current - 1)
    })
  }, [])

  const handleNext = useCallback(() => {
    setIndex((current) => {
      return Math.min(items.length - 1, current + 1)
    })
  }, [items.length])

  useChainKeys({ isEnabled: Boolean(request), onPrevious: handlePrevious, onNext: handleNext })

  if (!request) {
    return null
  }

  return (
    <Modal
      open
      onOpenChange={handleOpenChange}
      label="Media preview"
      backdropClassName="bg-black/80"
      className="flex h-[min(85vh,900px)] max-h-none w-[min(90vw,1200px)] flex-col overflow-hidden bg-page-2"
    >
      <PreviewHeader item={item} actions={request.actions} />

      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/60 p-3">
        <PreviewBody item={item} playerId={playerId} />

        <StageNavButton side="left" disabled={index <= 0} onClick={handlePrevious} />
        <StageNavButton side="right" disabled={index >= items.length - 1} onClick={handleNext} />
      </div>

      <PreviewFooter item={item} actions={request.actions} onRun={handleRun} />
    </Modal>
  )
}
