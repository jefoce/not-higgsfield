'use client'

import { isEmpty, sumBy } from 'lodash-es'
import { toast } from 'sonner'

import type { KindExtensions } from '@/core/media-kinds'
import { MEDIA_KINDS, type MediaKind } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'
import {
  extensionsFromLimits,
  openMediaPicker,
  type PickerCandidate,
} from '@/features/media-picker/picker/store'
import { UploadProgressTile } from '@/features/media-picker/uploads/UploadProgressTile'
import { useDropUpload } from '@/features/media-picker/uploads/use-drop-upload'
import { useUploadQueue } from '@/features/media-picker/uploads/use-upload-queue'

import { addBlockReason, referenceRoom } from '../reference-rules'
import { useGeneratorStore } from '../store/store'
import { ReferencesEmpty } from './ReferencesEmpty'
import { ReferencesGrid } from './ReferencesGrid'

function useReferenceIds(): string[] {
  return useGeneratorStore((state) => {
    return state.references
  })
}

function useUploadsById(): UploadsById {
  return useGeneratorStore((state) => {
    return state.uploadsById
  })
}

/** Reason an upload cannot be attached, null when it can. */
function referenceCanAdd(item: PickerCandidate): string | null {
  const state = useGeneratorStore.getState()
  const preset = getPreset(state.presetId)

  const room = referenceRoom({
    preset,
    references: state.references,
    uploadsById: state.uploadsById,
  })

  return addBlockReason({ kind: item.kind, room, preset })
}

/** Attaches an upload, or removes it when already attached. */
function toggleReference(item: UploadItem): void {
  const state = useGeneratorStore.getState()

  if (state.references.includes(item.id)) {
    state.removeReference(item.id)

    return
  }

  state.addReferences([item])
}

interface OpenReferencesPickerParams {
  kinds: MediaKind[]
  extensions?: KindExtensions
}

/** Opens reference picking in toggle mode. */
function openReferencesPicker(params: OpenReferencesPickerParams): void {
  const { kinds, extensions } = params

  if (isEmpty(kinds)) {
    return
  }

  openMediaPicker({
    kinds,
    extensions,
    mode: {
      kind: 'toggle',
      useSelectedIds: useReferenceIds,
      useUploadsById,
      canAdd: referenceCanAdd,
      onToggle: toggleReference,
    },
  })
}

/** References tab: limits, thumbs, reorder, drag-drop and mention insert. */
export function ReferencesBox() {
  const preset = getPreset(
    useGeneratorStore((state) => {
      return state.presetId
    }),
  )

  const extensions = extensionsFromLimits(preset.referenceLimits)

  const references = useGeneratorStore((state) => {
    return state.references
  })

  const uploadsById = useGeneratorStore((state) => {
    return state.uploadsById
  })

  const addReferences = useGeneratorStore((state) => {
    return state.addReferences
  })

  const queue = useUploadQueue(addReferences, (message) => {
    return toast.error(message)
  })

  const room = referenceRoom({ preset, references, uploadsById })

  const kinds = MEDIA_KINDS.filter((kind) => {
    return preset.references[kind] > 0
  })

  const max = sumBy(MEDIA_KINDS, (kind) => {
    return room[kind]
  })

  const dropKinds = MEDIA_KINDS.filter((kind) => {
    return room[kind] > 0
  })

  const handlePick = (): void => {
    openReferencesPicker({ kinds, extensions })
  }

  const { dragging: isDragging, dropProps } = useDropUpload({
    id: 'references',
    enabled: true,
    kinds: dropKinds,
    extensions,
    onUploaded: addReferences,
    onFiles: queue.enqueue,
  })

  if (references.length > 0) {
    return (
      <ReferencesGrid
        preset={preset}
        extensions={extensions}
        max={max}
        queue={queue}
        dropProps={dropProps}
        isDragging={isDragging}
        onPick={handlePick}
      />
    )
  }

  return (
    <>
      {queue.items.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-2">
          {queue.items.map((item) => {
            return <UploadProgressTile key={item.id} item={item} />
          })}
        </div>
      )}
      <ReferencesEmpty
        preset={preset}
        dropProps={dropProps}
        dragging={isDragging}
        onPick={handlePick}
      />
    </>
  )
}
