'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import { KIND_TITLE } from '@/core/media-kinds'
import type { UploadItem } from '@/core/types'
import { LazyVideo } from '@/features/player/LazyVideo'
import { usePlayerSlot } from '@/features/player/use-player-slot'
import { mediaUrl, thumbUrl } from '@/features/media-picker/api'
import { formatBytes, formatSecondsShort } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { cn } from '@/lib/cn'
import { PreviewAudio } from './PreviewAudio'
import { closePreview, usePreviewStore, type PreviewActions } from './preview-store'

type ActionKey = keyof Omit<PreviewActions, 'available' | 'label'>

const ACTIONS: { key: ActionKey; label: string }[] = [
  { key: 'insert', label: 'Insert in prompt' },
  { key: 'replace', label: 'Replace' },
  { key: 'remove', label: 'Remove' },
  { key: 'select', label: 'Select' },
  { key: 'deselect', label: 'Deselect' },
  { key: 'useAsStart', label: 'Use as start frame' },
  { key: 'addAsReference', label: 'Add as reference' },
]

const ACTION_VARIANT: Partial<Record<ActionKey, 'primary' | 'danger'>> = {
  insert: 'primary',
  remove: 'danger',
}

/** Full-size media preview with header, navigation and opener actions. */
export function MediaPreviewModal() {
  const request = usePreviewStore((state) => state.request)
  const [lastRequest, setLastRequest] = useState(request)
  const [index, setIndex] = useState(request?.index ?? 0)
  const { acquire, release } = usePlayerSlot()

  if (request !== lastRequest) {
    setLastRequest(request)
    setIndex(request?.index ?? 0)
  }

  const items = request?.items ?? []
  const item = items[index]
  const actions = request?.actions
  const playerId = item ? `preview:${item.id}` : ''

  useEffect(() => {
    if (!item || item.kind !== 'video') return
    acquire(playerId)
    return () => release(playerId)
  }, [acquire, item, playerId, release])

  useEffect(() => {
    if (!request) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1))
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(items.length - 1, current + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, request])

  if (!request) return null

  const run = (key: ActionKey) => {
    const action = actions?.[key]
    if (!action || !item) return
    closePreview() // close first so an opener action cannot stack modals
    action(item)
  }

  const label = item ? actions?.label?.(item) ?? KIND_TITLE[item.kind] : 'File missing'
  const available = item ? actions?.available?.(item) : undefined
  const provided = ACTIONS.filter(({ key }) => actions?.[key] && (!available || available.includes(key)))

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) closePreview()
      }}
      label="Media preview"
      backdropClassName="bg-black/80"
      className="flex h-[min(85vh,900px)] max-h-none w-[min(90vw,1200px)] flex-col overflow-hidden bg-page-2"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{item?.originalName ?? 'File missing'}</span>
          {item?.source === 'link' && (
            <span className="flex shrink-0 items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-xxs text-fg-2">
              <Link2 size={11} aria-hidden />
              Link
            </span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 text-xs text-fg-2">
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium text-fg">{label}</span>
          {item !== undefined && <span>{KIND_TITLE[item.kind]}</span>}
          {item !== undefined && <span>{formatBytes(item.sizeBytes)}</span>}
          {item !== undefined && item.durationSec != null && item.kind !== 'image' && (
            <span className="tabular-nums">{formatSecondsShort(item.durationSec)}</span>
          )}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/60 p-3">
        {item && !item.missing ? (
          <PreviewBody key={item.id} item={item} playerId={playerId} />
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm text-danger">
            <AlertTriangle size={24} aria-hidden />
            File missing
          </div>
        )}

        <NavButton
          side="left"
          disabled={index <= 0}
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
        />
        <NavButton
          side="right"
          disabled={index >= items.length - 1}
          onClick={() => setIndex((current) => Math.min(items.length - 1, current + 1))}
        />
      </div>

      {provided.length > 0 && (
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
          {provided.map(({ key, label: text }) => (
            <Button
              key={key}
              size="sm"
              variant={ACTION_VARIANT[key] ?? 'secondary'}
              onClick={() => run(key)}
            >
              {text}
            </Button>
          ))}
        </footer>
      )}
    </Modal>
  )
}

interface PreviewBodyProps {
  item: UploadItem
  playerId: string
}

function PreviewBody(props: PreviewBodyProps) {
  const { item, playerId } = props
  const src = mediaUrl(`uploads/${item.id}`, item.kind === 'image' ? undefined : item.mime)

  if (item.kind === 'video') {
    return (
      <LazyVideo
        id={playerId}
        src={src}
        poster={thumbUrl({ ref: `uploads/${item.id}`, w: 960 })}
        alt={item.originalName}
        className="h-full w-full"
      />
    )
  }

  if (item.kind === 'audio') return <PreviewAudio item={item} src={src} />

  return (
    // eslint-disable-next-line @next/next/no-img-element -- full original, not a thumb
    <img
      src={src}
      alt={item.originalName}
      className="h-full w-full object-contain"
    />
  )
}

interface NavButtonProps {
  side: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}

function NavButton(props: NavButtonProps) {
  const { side, disabled, onClick } = props
  const Icon = side === 'left' ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous media' : 'Next media'}
      className={cn(
        'absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-fg backdrop-blur transition hover:bg-black/80 disabled:opacity-30',
        side === 'left' ? 'left-4' : 'right-4',
      )}
    >
      <Icon size={20} aria-hidden />
    </button>
  )
}
