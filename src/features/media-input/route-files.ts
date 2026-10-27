import { isEmpty, isNil } from 'lodash-es'
import { toast } from 'sonner'
import { mutate } from 'swr'

import { isNonEmptyString } from '@/core/guards'
import { acceptFiles, type KindExtensions } from '@/core/media-kinds'
import { MEDIA_KINDS, type MediaKind } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import { referenceSlots } from '@/core/prompt-tokens'
import type { UploadItem } from '@/core/schemas/upload-item'
import { useGeneratorStore } from '@/features/generator/store/store'
import {
  closeMediaPicker,
  extensionsFromLimits,
  type PickerRequest,
  type PickerToggleMode,
  useMediaPickerStore,
} from '@/features/media-picker/picker/store'
import { uploadFiles } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'

/** Attaches uploads to the active tab. */
function route(items: UploadItem[]): void {
  const state = useGeneratorStore.getState()

  if (state.tab === 'references') {
    state.addReferences(items)

    return
  }

  const preset = getPreset(state.presetId)
  let slot: 'start' | 'end' = 'start'

  const hasStart = isNonEmptyString(state.frames.start)
  const hasEnd = isNonEmptyString(state.frames.end)

  if (hasStart && preset.frames.end && !hasEnd) {
    slot = 'end'
  }

  const image = items.find((item) => {
    return item.kind === 'image'
  })

  if (!image) {
    toast.error('Frames need an image')

    return
  }

  state.setFrame(slot, image)
}

/** Kinds the active tab can still take. */
function allowedKinds(): MediaKind[] {
  const state = useGeneratorStore.getState()

  if (state.tab !== 'references') {
    return ['image']
  }

  const preset = getPreset(state.presetId)

  const { counts } = referenceSlots(state.references, (id) => {
    return state.uploadsById[id]?.kind
  })

  return MEDIA_KINDS.filter((kind) => {
    return counts[kind] < preset.references[kind]
  })
}

/** Preset formats for the active model. */
function allowedExtensions(): KindExtensions | undefined {
  return extensionsFromLimits(getPreset(useGeneratorStore.getState().presetId).referenceLimits)
}

interface SkipReport {
  count: number
  reason: string
}

/** One toast for every file the target refused. */
function reportSkipped(report: SkipReport): void {
  const { count, reason } = report
  const suffix = count === 1 ? '' : 's'

  toast(`Skipped ${count} file${suffix} (${reason})`)
}

function revalidateUploads(): void {
  void mutate(
    (key) => {
      return Array.isArray(key) && key[0] === 'uploads'
    },
    undefined,
    { revalidate: true },
  )
}

interface ToggleResult {
  skipped: number
  reason: string | null
}

/** Toggles every upload the mode still accepts, counting the rest. */
function applyToggle(mode: PickerToggleMode, items: UploadItem[]): ToggleResult {
  let skipped = 0
  let reason: string | null = null

  for (const item of items) {
    const blocked = mode.canAdd(item)

    if (!isNil(blocked)) {
      skipped += 1
      reason ??= blocked

      continue
    }

    mode.onToggle(item)
  }

  return { skipped, reason }
}

function pickFirst(request: PickerRequest, items: UploadItem[]): void {
  const [first] = items

  if (isNil(first) || request.mode.kind !== 'pick') {
    return
  }

  request.mode.onPick(first)
  closeMediaPicker()
}

/** Routes files into the open picker request instead of the generator tab. */
async function routeToPicker(request: PickerRequest, files: File[]): Promise<void> {
  const { accepted, skipped } = acceptFiles({
    files,
    kinds: request.kinds,
    extensions: request.extensions,
  })

  if (isEmpty(accepted)) {
    if (skipped > 0) {
      reportSkipped({ count: skipped, reason: 'unsupported file' })
    }

    return
  }

  try {
    const items = await uploadFiles(accepted)

    if (request.mode.kind === 'pick') {
      pickFirst(request, items)

      if (skipped > 0) {
        reportSkipped({ count: skipped, reason: 'unsupported file' })
      }

      return
    }

    const toggled = applyToggle(request.mode, items)

    revalidateUploads()

    const count = skipped + toggled.skipped

    if (count > 0) {
      reportSkipped({ count, reason: toggled.reason ?? 'unsupported file' })
    }
  } catch (error) {
    toastError(error)
  }
}

/** Filters by the open picker or active tab, uploads the accepted files and routes the result. */
export async function routeFiles(files: File[]): Promise<void> {
  const request = useMediaPickerStore.getState().request

  if (!isNil(request)) {
    await routeToPicker(request, files)

    return
  }

  const { accepted, skipped } = acceptFiles({
    files,
    kinds: allowedKinds(),
    extensions: allowedExtensions(),
  })

  if (skipped > 0) {
    const suffix = skipped === 1 ? '' : 's'

    toast(`Skipped ${skipped} unsupported file${suffix}`)
  }

  if (isEmpty(accepted)) {
    return
  }

  try {
    const items = await uploadFiles(accepted)

    route(items)
  } catch (error) {
    toastError(error)
  }
}
