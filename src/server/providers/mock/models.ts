import 'server-only'

import { MODEL_PRESETS } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'

import type { ProviderModel } from '../types'

/** Static capabilities for the four presets, no provider call. */
export async function listModels(): Promise<readonly ProviderModel[]> {
  return MODEL_PRESETS.map(staticModel)
}

function staticModel(preset: ModelPreset): ProviderModel {
  return {
    modelId: preset.slug,
    durations: preset.duration.options ?? allDurations(preset),
    resolutions: preset.resolutions,
    aspectRatios: preset.aspectRatios,
    frameImages: frameImages(preset),
    generatesAudio: preset.audio.supported,
    hasSeed: preset.seed,
  }
}

function allDurations(preset: ModelPreset): number[] {
  const { min, max } = preset.duration

  return Array.from({ length: max - min + 1 }, (_, index) => min + index)
}

function frameImages(preset: ModelPreset): readonly string[] | null {
  if (!preset.frames.start) {
    return null
  }

  if (!preset.frames.end) {
    return ['first_frame']
  }

  return ['first_frame', 'last_frame']
}
