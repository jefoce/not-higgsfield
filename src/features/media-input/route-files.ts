import { isEmpty } from 'lodash-es'
import { toast } from 'sonner'

import { isNonEmptyString } from '@/core/guards'
import { acceptFiles, type KindExtensions } from '@/core/media-kinds'
import { MEDIA_KINDS, type MediaKind } from '@/core/media-types'
import { getPreset } from '@/core/presets'
import { referenceSlots } from '@/core/prompt-tokens'
import type { UploadItem } from '@/core/schemas/upload-item'
import { useGeneratorStore } from '@/features/generator/store/store'
import { extensionsFromLimits } from '@/features/media-picker/picker/store'
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

/** Filters by the active tab, uploads the accepted files and routes the result. */
export async function routeFiles(files: File[]): Promise<void> {
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
