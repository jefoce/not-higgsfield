import { minDuration, type ModelPreset } from './presets'
import type { GenerationInput, UploadItem } from './types'

interface ReferenceDurationLimitParams {
  references: readonly string[]
  uploads: Record<string, UploadItem>
  preset: ModelPreset
}

/** Numeric duration cap from the total kept video reference time. */
export function durationLimitFor(params: ReferenceDurationLimitParams): number {
  const { references, uploads, preset } = params
  if (preset.maxInputPlusOutputSec === null) return preset.duration.max
  const total = references.reduce((sum, id) => {
    const upload = uploads[id]
    return upload?.kind === 'video' ? sum + (upload.durationSec ?? 0) : sum
  }, 0)
  if (!total) return preset.duration.max
  const room = Math.floor(preset.maxInputPlusOutputSec - total)
  return Math.max(minDuration(preset), Math.min(preset.duration.max, room))
}

interface MaxDurationForParams {
  input: GenerationInput
  uploads: Record<string, UploadItem>
  preset: ModelPreset
}

/** Longest allowed output duration, capped by references and preset options. */
export function maxDurationFor(params: MaxDurationForParams): number {
  const { input, uploads, preset } = params
  if (preset.maxInputPlusOutputSec === null) return preset.duration.max
  const references = input.tab === 'references' ? input.references : []
  const limit = durationLimitFor({ references, uploads, preset })
  const options = preset.duration.options
  if (!options?.length) return limit
  const fits = options.filter((option) => option <= limit)
  return fits.length ? Math.max(...fits) : Math.min(...options)
}
