'use client'

import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import type { UploadItem } from '@/core/types'
import { cn } from '@/lib/cn'
import { ReferenceThumb } from './ReferenceThumb'

interface SortableReferenceProps {
  id: string
  upload?: UploadItem
  label?: string
  note?: string
  onOpenPreview?: () => void
  onRemove: () => void
}

/** Grid cell that owns the sort transform and pointer/keyboard listeners. */
export function SortableReference(props: SortableReferenceProps) {
  const { id, upload, label, note, onOpenPreview, onRemove } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const isAudio = upload?.kind === 'audio'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        isAudio ? 'col-span-2 aspect-[2.12/1]' : 'aspect-square',
        isDragging && 'rounded-xl opacity-30 outline-dashed outline-1 outline-lime/60',
      )}
      {...attributes}
      {...listeners}
    >
      <ReferenceThumb
        upload={upload}
        label={label}
        note={note}
        onOpenPreview={onOpenPreview}
        onRemove={onRemove}
      />
    </div>
  )
}
