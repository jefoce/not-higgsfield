import { clamp, minBy } from 'lodash-es'
import { durationLimitFor } from './duration-limits'
import { MEDIA_KINDS } from './media-kinds'
import { aspectAllowed } from './output-size'
import { minDuration, type ModelPreset } from './presets'
import type { GenerationInput, MediaKind, UploadItem } from './types'

/** Drop media belonging to the inactive tab. Returns a new object. */
export function inputForSubmit(input: GenerationInput): GenerationInput {
  if (input.tab !== 'frames') return { ...input, frames: { start: null, end: null } }
  const end = input.frames.start ? input.frames.end : null
  return { ...input, references: [], frames: { start: input.frames.start, end } }
}

const nearestOption = (options: readonly number[], value: number): number =>
  minBy(options, (option) => Math.abs(option - value)) ?? options[0]

/** Nearest allowed duration inside the reference limit. */
export const clampDuration = (value: number, preset: ModelPreset, limit: number): number => {
  const min = minDuration(preset)
  const options = preset.duration.options
  if (!options?.length) return clamp(Math.round(value), min, limit)
  const allowed = options.filter((option) => option >= min && option <= limit)
  return allowed.length ? nearestOption(allowed, value) : clamp(nearestOption(options, value), min, limit)
}

interface NormalizeAspectParams {
  aspect: GenerationInput['aspectRatio']
  preset: ModelPreset
  resolution: GenerationInput['resolution']
}

function normalizeAspect(params: NormalizeAspectParams): GenerationInput['aspectRatio'] {
  const { aspect, preset, resolution } = params
  if (aspect === 'auto') return preset.autoAspectWithFrames ? 'auto' : preset.defaultAspectRatio
  return aspectAllowed({ preset, resolution, aspect }) ? aspect : preset.defaultAspectRatio
}

function normalizeFrames(
  frames: GenerationInput['frames'],
  preset: ModelPreset,
): GenerationInput['frames'] {
  if (!preset.frames.start || !frames.start) return { start: null, end: null }
  if (!preset.frames.end || !frames.end) return { start: frames.start, end: null }
  return { start: frames.start, end: frames.end }
}

const referencesDisabled = (preset: ModelPreset): boolean =>
  MEDIA_KINDS.every((kind) => preset.references[kind] === 0)

interface TrimReferencesParams {
  ids: string[]
  preset: ModelPreset
  uploads: Record<string, UploadItem>
}

/** Keep references in order, dropping any past the per-kind limit. */
function trimReferences(params: TrimReferencesParams): { references: string[]; notes: string[] } {
  const { ids, preset, uploads } = params
  const counts: Record<MediaKind, number> = { image: 0, video: 0, audio: 0 }
  const removed: Record<MediaKind, number> = { image: 0, video: 0, audio: 0 }

  const references = ids.filter((id) => {
    const kind = uploads[id]?.kind
    if (!kind) return true // unknown until uploads load, decided later
    if (counts[kind] < preset.references[kind]) {
      counts[kind] += 1
      return true
    }
    removed[kind] += 1
    return false
  })

  const notes = MEDIA_KINDS.filter((kind) => removed[kind] > 0).map(
    (kind) => `Removed ${removed[kind]} ${kind} reference${removed[kind] === 1 ? '' : 's'}`,
  )
  return { references, notes }
}

interface NormalizeForPresetParams {
  input: GenerationInput
  preset: ModelPreset
  uploads?: Record<string, UploadItem>
}

/** Fit a draft input to a preset without mutating it. Notes list every change. */
export function normalizeForPreset(params: NormalizeForPresetParams): { input: GenerationInput; notes: string[] } {
  const { input, preset, uploads = {} } = params
  const notes: string[] = []
  let tab = input.tab
  let references = input.references
  if (referencesDisabled(preset)) {
    if (tab === 'references') {
      tab = 'frames'
      notes.push(`References not supported by ${preset.title}`)
    }
  } else {
    const trimmed = trimReferences({ ids: input.references, preset, uploads })
    references = trimmed.references
    notes.push(...trimmed.notes)
  }

  const limit = durationLimitFor({ references: tab === 'references' ? references : [], uploads, preset })
  const duration = clampDuration(input.duration, preset, limit)
  if (duration !== input.duration) notes.push(`Duration set to ${duration}s`)

  let resolution = input.resolution
  if (!preset.resolutions.includes(resolution)) {
    resolution = preset.defaultResolution
    notes.push(`Resolution set to ${resolution}`)
  }

  const aspectRatio = normalizeAspect({ aspect: input.aspectRatio, preset, resolution })
  if (aspectRatio !== input.aspectRatio && input.aspectRatio !== 'auto') {
    notes.push(`Aspect set to ${aspectRatio}`)
  }

  return {
    input: {
      ...input,
      presetId: preset.id,
      tab,
      duration,
      resolution,
      aspectRatio,
      audio: preset.audio.supported ? input.audio : false,
      frames: normalizeFrames(input.frames, preset),
      references,
    },
    notes,
  }
}
