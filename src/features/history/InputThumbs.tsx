'use client'

import { useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { referenceSlots, slotLabel } from '@/core/prompt-tokens'
import type { GenerationRecord } from '@/core/types'
import { fetchUploads } from '@/features/media-picker/api'
import { errorMessage } from '@/lib/errors'
import { formatBytes } from '@/lib/format'
import { openPreview, type PreviewActions } from '@/features/preview/preview-store'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/ui/Tooltip'
import { uploadThumb } from './record-view'
import { useGeneratorStore } from '@/features/generator/store'

interface ThumbItem {
  id: string
  label: string
  name: string
  missing: boolean
  sent?: string
}

interface ThumbProps {
  item: ThumbItem
  index: number
  onOpen?: () => void
}

function Thumb(props: ThumbProps) {
  const { item, index, onOpen } = props
  const [broken, setBroken] = useState(false)
  const initial = item.name.charAt(0).toUpperCase() || '?'

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpen?.()
  }

  const title = `${item.label} \u00b7 ${item.name}`
  const tooltip = item.sent ? `${title} \u00b7 ${item.sent}` : title
  const role = onOpen ? 'button' : undefined
  const tabIndex = onOpen ? 0 : undefined
  return (
    <Tooltip content={tooltip}>
      <div
        role={role}
        tabIndex={tabIndex}
        onClick={onOpen}
        onKeyDown={onKeyDown}
        className={cn(
          'group relative h-10 w-10 overflow-hidden rounded-lg border border-line bg-subtle transition-transform hover:z-10 hover:rotate-0 hover:scale-125',
          index % 2 ? 'rotate-[5deg]' : '-rotate-[5deg]',
          onOpen && 'cursor-pointer',
        )}
      >
        {broken || item.missing ? (
          <span className="flex h-full w-full items-center justify-center text-xs font-medium text-fg-2">
            {initial}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- pre-sized upload thumb
          <img
            src={uploadThumb(item.id)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover bg-black/40"
          />
        )}
        <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/50" aria-hidden />
      </div>
    </Tooltip>
  )
}

interface InputThumbsProps {
  record: GenerationRecord
}

function sentNote(item: GenerationRecord['inputsSnapshot'][string] | undefined): string | undefined {
  if (!item?.sentWidth || !item.sentHeight || item.sentBytes == null) return undefined
  const format = item.format ? item.format.toUpperCase() : 'image'
  return `Sent as ${format} ${item.sentWidth}x${item.sentHeight}, ${formatBytes(item.sentBytes)}`
}

/** Start/end frames and reference thumbs, grey initial when the file is gone. */
export function InputThumbs(props: InputThumbsProps) {
  const { record } = props
  const { tab, frames, references } = record.input
  const items: ThumbItem[] = []
  const snapshot = record.inputsSnapshot
  const thumb = (id: string, label: string): ThumbItem => {
    const item = snapshot[id]
    return {
      id,
      label,
      name: item?.originalName ?? 'Deleted upload',
      missing: !item,
      sent: sentNote(item),
    }
  }

  if (tab === 'frames') {
    for (const [label, id] of [
      ['Start frame', frames.start],
      ['End frame', frames.end],
    ] as const) {
      if (id) items.push(thumb(id, label))
    }
  }

  if (tab === 'references') {
    const { slots } = referenceSlots(references, (id) => snapshot[id]?.kind)
    for (const id of references) {
      const slot = slots.get(id)
      items.push(thumb(id, slot ? slotLabel(slot) : 'Reference'))
    }
  }

  if (!items.length) return null

  const open = async (item: ThumbItem) => {
    try {
      const [upload] = await fetchUploads({ ids: [item.id] })
      if (!upload || upload.missing) {
        toast.error('File no longer exists')
        return
      }
      const actions: PreviewActions = {
        useAsStart: (current) => {
          const store = useGeneratorStore.getState()
          store.setTab('frames')
          store.setFrame('start', current)
        },
        addAsReference: (current) => useGeneratorStore.getState().addReferences([current]),
        available: (current) =>
          current.kind === 'image' ? ['useAsStart', 'addAsReference'] : ['addAsReference'],
      }
      openPreview({ items: [upload], index: 0, actions })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <Thumb
          key={`${item.label}-${item.id}`}
          item={item}
          index={index}
          onOpen={() => void open(item)}
        />
      ))}
    </div>
  )
}
