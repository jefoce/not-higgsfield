import { isNil, isString } from 'lodash-es'
import { toast } from 'sonner'

import type { MediaKindCounts } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import { referenceSlots, type RefSlot, slotToken } from '@/core/prompt-tokens'
import type { GenerationRecord, GeneratorTab } from '@/core/schemas/generation-record'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'
import { captureGenerationFrame } from '@/lib/api/generations'
import { linkFolderFile, linkGenerationFile } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'

import { addBlockReason, referenceRoom } from './reference-rules'
import { useGeneratorStore } from './store/store'

interface UploadMediaTarget {
  kind: 'upload'
  upload: UploadItem
}

interface RecordMediaTarget {
  kind: 'record'
  record: GenerationRecord
}

export type MediaTarget = UploadMediaTarget | RecordMediaTarget

interface MediaFrames {
  start: string | null
  end: string | null
}

export interface MediaUseState {
  tab: GeneratorTab
  presetId: string
  references: string[]
  frames: MediaFrames
  uploadsById: UploadsById
}

export interface MediaUse {
  label: string
  isDisabled: boolean
  reason: string
}

interface UseContext {
  label: string
  preset: ModelPreset
  room: MediaKindCounts
  slots: Map<string, RefSlot>
  state: MediaUseState
}

function enabled(label: string): MediaUse {
  return { label, isDisabled: false, reason: label }
}

function disabled(label: string, reason: string): MediaUse {
  return { label, isDisabled: true, reason }
}

function referenceRecordUse(context: UseContext): MediaUse {
  const { label, preset, room } = context
  const reason = addBlockReason({ kind: 'video', room, preset })

  if (!isNil(reason)) {
    return disabled(label, reason)
  }

  return enabled(label)
}

function referenceUploadUse(context: UseContext, upload: UploadItem): MediaUse {
  const { label, preset, room, slots, state } = context
  const slot = slots.get(upload.id)

  if (state.references.includes(upload.id)) {
    if (isNil(slot)) {
      return disabled(label, label)
    }

    return disabled(label, `Already ${slotToken(slot)}`)
  }

  const reason = addBlockReason({ kind: upload.kind, room, preset })

  if (!isNil(reason)) {
    return disabled(label, reason)
  }

  return enabled(label)
}

function frameRecordUse(context: UseContext): MediaUse {
  const { label, preset } = context

  if (!preset.frames.start) {
    return disabled(label, 'This model does not take a start frame')
  }

  return enabled(label)
}

function frameUploadUse(context: UseContext, upload: UploadItem): MediaUse {
  const { label, preset, state } = context

  if (upload.kind !== 'image') {
    return disabled(label, 'Start frame takes an image')
  }

  if (state.frames.start === upload.id) {
    return disabled(label, 'Already the start frame')
  }

  if (!preset.frames.start) {
    return disabled(label, 'This model does not take a start frame')
  }

  return enabled(label)
}

/**
 * Use-button state for a media target in the active generator mode.
 * Pure: the same target and state always give the same label and reason.
 */
export function mediaUse(target: MediaTarget, state: MediaUseState): MediaUse {
  const label = state.tab === 'frames' ? 'Start frame' : 'Reference'
  const preset = getPreset(state.presetId)

  const room = referenceRoom({
    preset,
    references: state.references,
    uploadsById: state.uploadsById,
  })

  const slots = referenceSlots(state.references, (id) => {
    return state.uploadsById[id]?.kind
  }).slots

  const context: UseContext = { label, preset, room, slots, state }

  if (state.tab === 'references') {
    if (target.kind === 'record') {
      return referenceRecordUse(context)
    }

    return referenceUploadUse(context, target.upload)
  }

  if (target.kind === 'record') {
    return frameRecordUse(context)
  }

  return frameUploadUse(context, target.upload)
}

interface FolderRef {
  folderId: string
  relPath: string
}

/** Read-only folder ref, present only on picker items that are still unlinked. */
function folderPreviewRef(upload: UploadItem): string | null {
  if (!('previewRef' in upload)) {
    return null
  }

  const ref = upload.previewRef

  if (!isString(ref)) {
    return null
  }

  return ref
}

/** `folders/<folderId>/<relPath>` to its two parts, null for any other shape. */
function folderRef(ref: string): FolderRef | null {
  const rest = ref.slice('folders/'.length)
  const slash = rest.indexOf('/')

  if (slash <= 0 || slash === rest.length - 1) {
    return null
  }

  return { folderId: rest.slice(0, slash), relPath: rest.slice(slash + 1) }
}

async function linkedUpload(upload: UploadItem): Promise<UploadItem | null> {
  const ref = folderPreviewRef(upload)

  if (isNil(ref) || !ref.startsWith('folders/')) {
    return upload
  }

  const folder = folderRef(ref)

  if (isNil(folder)) {
    return upload
  }

  try {
    return await linkFolderFile(folder)
  } catch (error) {
    toastError(error)

    return null
  }
}

async function applyRecordFrame(record: GenerationRecord): Promise<boolean> {
  try {
    const upload = await captureGenerationFrame(record.id, 'last')
    const store = useGeneratorStore.getState()

    if (store.tab !== 'frames') {
      store.setTab('frames')
    }

    store.setFrame('start', upload)
    toast.success('Start frame set')

    return true
  } catch (error) {
    toastError(error)

    return false
  }
}

async function applyRecordReference(record: GenerationRecord): Promise<boolean> {
  try {
    const upload = await linkGenerationFile({ generationId: record.id })
    const store = useGeneratorStore.getState()

    if (store.tab !== 'references') {
      store.setTab('references')
    }

    store.addReferences([upload])

    const isAdded = useGeneratorStore.getState().references.includes(upload.id)

    if (isAdded) {
      toast.success('Added as reference')
    } else {
      toast.error('Reference limit reached')
    }

    return isAdded
  } catch (error) {
    toastError(error)

    return false
  }
}

function applyUploadFrame(upload: UploadItem): boolean {
  if (upload.kind !== 'image') {
    return false
  }

  useGeneratorStore.getState().setFrame('start', upload)
  toast.success('Start frame set')

  return true
}

function applyUploadReference(upload: UploadItem): boolean {
  const store = useGeneratorStore.getState()

  if (store.references.includes(upload.id)) {
    toast.error('Already attached')

    return false
  }

  store.addReferences([upload])

  const isAdded = useGeneratorStore.getState().references.includes(upload.id)

  if (isAdded) {
    toast.success('Added as reference')

    return true
  }

  toast.error('Reference limit reached')

  return false
}

/**
 * Applies a target to the current generator tab, linking folder files first.
 * Reads the live store, so callers never pass stale draft state.
 */
export async function applyMedia(target: MediaTarget): Promise<boolean> {
  if (target.kind === 'record') {
    if (useGeneratorStore.getState().tab === 'frames') {
      return applyRecordFrame(target.record)
    }

    return applyRecordReference(target.record)
  }

  const upload = await linkedUpload(target.upload)

  if (isNil(upload)) {
    return false
  }

  if (useGeneratorStore.getState().tab === 'frames') {
    return applyUploadFrame(upload)
  }

  return applyUploadReference(upload)
}
