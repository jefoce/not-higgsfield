'use client'

import { useState } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { keyBy } from 'lodash-es'
import { toast } from 'sonner'
import { MEDIA_KINDS } from '@/core/media-kinds'
import { getPreset } from '@/core/presets'
import { referenceSlots, slotLabel } from '@/core/prompt-tokens'
import type { MediaKind } from '@/core/types'
import { UploadProgressTile } from '@/features/media-picker/UploadProgressTile'
import { useDropUpload } from '@/features/media-picker/use-drop-upload'
import { useUploadQueue } from '@/features/media-picker/use-upload-queue'
import { extensionsFromLimits, openMediaPicker } from '@/features/media-picker/store'
import { openPreview } from '@/features/preview/preview-store'
import { cn } from '@/lib/cn'
import { AddReferenceTile } from './AddReferenceTile'
import { ReferenceCounters } from './ReferenceCounters'
import { ReferencesEmpty } from './ReferencesEmpty'
import { ReferenceThumb } from './ReferenceThumb'
import { SortableReference } from './SortableReference'
import { useImagePlan } from './use-image-plan'
import { useGeneratorStore } from './store'

/** References tab: limits, thumbs, reorder, drag-drop and mention insert. */
export function ReferencesBox() {
  const preset = getPreset(useGeneratorStore((state) => state.presetId))
  const extensions = extensionsFromLimits(preset.referenceLimits)
  const references = useGeneratorStore((state) => state.references)
  const uploadsById = useGeneratorStore((state) => state.uploadsById)
  const addReferences = useGeneratorStore((state) => state.addReferences)
  const removeReference = useGeneratorStore((state) => state.removeReference)
  const replaceReference = useGeneratorStore((state) => state.replaceReference)
  const insertMention = useGeneratorStore((state) => state.insertMention)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null)
  const queue = useUploadQueue(addReferences, (message) => toast.error(message))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const order = previewOrder ?? references
  const { counts, slots } = referenceSlots(order, (id) => uploadsById[id]?.kind)
  const plan = useImagePlan(preset.id, references.filter((id) => uploadsById[id]?.kind === 'image'))
  const planned = keyBy(plan?.images ?? [], 'id')

  const noteFor = (id: string): string | undefined => {
    const image = planned[id]
    if (!image) return undefined
    const size = `Sent at ${image.width}x${image.height}`
    if (!image.flattened) return size
    return `${size} \u00b7 Transparent, sent on ${image.flattened === '#ffffff' ? 'white' : 'dark'}`
  }

  const labelFor = (id: string) => {
    const slot = slots.get(id)
    return slot ? slotLabel(slot) : undefined
  }

  const remaining = (kind: MediaKind) => preset.references[kind] - counts[kind]
  const kinds = MEDIA_KINDS.filter((kind) => remaining(kind) > 0)
  const max = kinds.reduce((sum, kind) => sum + remaining(kind), 0)

  const openPicker = () => {
    if (!kinds.length) return
    openMediaPicker({ target: 'references', kinds, max, extensions, onPick: addReferences })
  }

  const previewUploads = references.flatMap((id) => {
    const upload = uploadsById[id]
    return upload ? [upload] : []
  })

  const indexes = (a: string, b: string) => [references.indexOf(a), references.indexOf(b)] as const

  const thumbProps = (id: string) => {
    const upload = uploadsById[id]
    return {
      upload,
      label: labelFor(id),
      note: noteFor(id),
      onOpenPreview:
        upload && upload.kind !== 'audio'
          ? () =>
              openPreview({
                items: previewUploads,
                index: previewUploads.findIndex((item) => item.id === id),
                actions: {
                  insert: (item) => {
                    const slot = slots.get(item.id)
                    if (slot) insertMention(slot)
                  },
                  replace: (item) =>
                    openMediaPicker({
                      target: 'references',
                      kinds: [item.kind],
                      max: 1,
                      extensions,
                      onPick: ([next]) => {
                        if (next) replaceReference(item.id, next)
                      },
                    }),
                  remove: (item) => removeReference(item.id),
                  label: (item) => labelFor(item.id) ?? null,
                },
              })
          : undefined,
      onRemove: () => removeReference(id),
    }
  }

  const { dragging, dropProps } = useDropUpload({
    id: 'references',
    enabled: true,
    kinds,
    extensions,
    onUploaded: addReferences,
    onFiles: queue.enqueue,
  })

  if (references.length) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(String(active.id))}
        onDragOver={({ active, over }) => {
          if (!over || active.id === over.id) return
          const [from, to] = indexes(String(active.id), String(over.id))
          if (from < 0 || to < 0 || from === to) return
          setPreviewOrder(arrayMove(references, from, to))
        }}
        onDragEnd={({ active, over }) => {
          setActiveId(null)
          setPreviewOrder(null)
          if (!over || active.id === over.id) return
          const [from, to] = indexes(String(active.id), String(over.id))
          if (from < 0 || to < 0 || from === to) return
          useGeneratorStore.setState({ references: arrayMove(references, from, to) })
        }}
        onDragCancel={() => {
          setActiveId(null)
          setPreviewOrder(null)
        }}
      >
        <div
          className={cn(
            'min-h-[138px] max-h-[200px] overflow-y-auto rounded-2xl border border-transparent bg-surface p-4',
            dragging && 'ring-1 ring-lime/40',
          )}
          {...dropProps}
        >
          <ReferenceCounters counts={counts} preset={preset} plan={plan} />
          <div className="grid grid-cols-4 justify-center gap-2">
            {max > 0 && <AddReferenceTile onPick={openPicker} />}
            <SortableContext items={references} strategy={rectSortingStrategy}>
              {references.map((id) => (
                <SortableReference key={id} id={id} {...thumbProps(id)} />
              ))}
            </SortableContext>
            {queue.items.map((item) => (
              <UploadProgressTile key={item.id} item={item} />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeId !== null && <ReferenceThumb {...thumbProps(activeId)} lifted />}
        </DragOverlay>
      </DndContext>
    )
  }

  return (
    <>
      {queue.items.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-2">
          {queue.items.map((item) => (
            <UploadProgressTile key={item.id} item={item} />
          ))}
        </div>
      )}
      <ReferencesEmpty preset={preset} dropProps={dropProps} dragging={dragging} onPick={openPicker} />
    </>
  )
}
