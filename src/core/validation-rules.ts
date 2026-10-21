import { LOW_RES_MIN_PX, MAX_ACTIVE_JOBS, MAX_INLINE_MEDIA_MB } from './constants'
import { maxDurationFor } from './duration-limits'
import { KIND_TITLE, MEDIA_KINDS } from './media-kinds'
import { aspectAllowed } from './output-size'
import { missingSlots, referenceSlots } from './prompt-tokens'
import type { ModelPreset } from './presets'
import { resolveTransport } from './transport'
import type { GenerationInput, MediaKind, UploadItem } from './types'
import { checkReferenceLimits, seconds } from './validation-media'
import type { RuleResult, ValidationContext, ValidationIssue } from './validation-types'

const byteLimit = MAX_INLINE_MEDIA_MB * 1024 * 1024

interface ValidateFramesParams {
  input: GenerationInput
  uploads: Record<string, UploadItem>
  preset: ModelPreset
}

interface ValidateWithContextParams extends ValidateFramesParams {
  ctx: ValidationContext
}

interface CheckRefDurationsParams {
  kind: 'video' | 'audio'
  items: UploadItem[]
  preset: ModelPreset
  errors: string[]
}

interface CheckUploadParams {
  id: string | null
  role: string
  uploads: Record<string, UploadItem>
  errors: string[]
}

export function validatePrompt(input: GenerationInput, preset: ModelPreset): RuleResult {
  const errors: string[] = []
  const hasStartFrame = input.tab === 'frames' && Boolean(input.frames.start)
  if (input.prompt.trim().length > preset.promptMaxChars) errors.push(`Prompt is too long (max ${preset.promptMaxChars} characters)`)
  if (!input.prompt.trim() && !(preset.promptOptional && hasStartFrame)) errors.push('Prompt is required')
  if (input.aspectRatio === 'auto' && !(input.tab === 'frames' && input.frames.start && preset.autoAspectWithFrames)) {
    errors.push('Auto aspect ratio needs a start frame')
  }
  const aspect = input.aspectRatio
  if (aspect !== 'auto' && !aspectAllowed({ preset, resolution: input.resolution, aspect })) {
    const resolutions = preset.resolutions.filter((resolution) => preset.outputSizes?.[resolution]?.[aspect])
    errors.push(`Aspect ${aspect} is only available at ${resolutions.join(' or ')}`)
  }
  return { errors, warnings: [] }
}

export function validateFrames(params: ValidateFramesParams): RuleResult {
  const { input, uploads, preset } = params
  const errors: string[] = []
  if (input.tab !== 'frames') return { errors, warnings: [] }

  if (input.frames.end && !input.frames.start) errors.push('Add a start frame first')
  if (input.frames.end && !preset.frames.end) errors.push('End frame is not supported by this model')
  const start = checkUpload({ id: input.frames.start, role: 'Start frame', uploads, errors })
  if (start && start.kind !== 'image') errors.push('Start frame must be an image')
  if (input.frames.start && input.frames.end) {
    const end = checkUpload({ id: input.frames.end, role: 'End frame', uploads, errors })
    if (end && end.kind !== 'image') errors.push('End frame must be an image')
  }
  for (const upload of attachedMedia(input, uploads)) {
    if (upload.kind === 'image') checkReferenceLimits({ upload, preset, errors })
  }
  return { errors, warnings: [] }
}

export function validateReferences(params: ValidateWithContextParams): RuleResult {
  const { input, uploads, preset, ctx } = params
  const errors: string[] = []
  const warnings: ValidationIssue[] = []
  if (input.tab !== 'references') return { errors, warnings }
  if (MEDIA_KINDS.every((kind) => preset.references[kind] === 0)) {
    errors.push(`References are not supported by ${preset.title}`)
    return { errors, warnings }
  }

  const attached: UploadItem[] = []
  for (const id of input.references) {
    const upload = uploads[id]
    if (!upload) {
      errors.push('Reference file not found')
      continue
    }
    attached.push(upload)
    if (upload.missing) errors.push(`File missing: ${upload.originalName}`)
    else checkReferenceLimits({ upload, preset, errors })
  }
  const { counts } = referenceSlots(input.references, (id) => uploads[id]?.kind)
  for (const kind of MEDIA_KINDS) {
    if (counts[kind] > preset.references[kind]) errors.push(`Too many ${kind}s (${counts[kind]}, max ${preset.references[kind]})`)
  }
  for (const kind of REMOTE_REF_KINDS) {
    if (!counts[kind] || ctx.remoteConfigured) continue
    if (resolveTransport({ preset, kind, remoteConfigured: false }) !== 'url') continue
    errors.push(`${KIND_TITLE[kind]} references for ${preset.title} need cloud storage (R2) configured`)
  }

  const videos = attached.filter((upload) => upload.kind === 'video')
  const audio = attached.filter((upload) => upload.kind === 'audio')
  if (preset.references.audioNeedsVisual && audio.length && !counts.image && !counts.video) {
    errors.push('Audio references need at least one image or video reference')
  }
  checkRefDurations({ kind: 'video', items: videos, preset, errors })
  checkRefDurations({ kind: 'audio', items: audio, preset, errors })
  const videoTotal = videos.reduce((sum, upload) => sum + (upload.durationSec ?? 0), 0)
  const audioTotal = audio.reduce((sum, upload) => sum + (upload.durationSec ?? 0), 0)
  if (videoTotal > preset.references.videoTotalSec) errors.push(`Video references are too long in total (${videoTotal}s, max ${preset.references.videoTotalSec}s)`)
  if (audioTotal > preset.references.audioTotalSec) errors.push(`Audio references are too long in total (${audioTotal}s, max ${preset.references.audioTotalSec}s)`)

  if (preset.maxInputPlusOutputSec !== null && videos.length) {
    const limit = maxDurationFor({ input, uploads, preset })
    if (input.duration > limit) errors.push(`Max ${limit}s: reference videos are ${seconds(videoTotal)}s in total, limit ${preset.maxInputPlusOutputSec}s`)
  }
  for (const slot of missingSlots(input.prompt, counts)) {
    warnings.push({ type: 'missing-slot', slot, attached: counts[slot.kind] })
  }
  return { errors, warnings }
}

export function validateLimits(params: ValidateWithContextParams): RuleResult {
  const { input, uploads, preset, ctx } = params
  const errors: string[] = []
  const warnings: ValidationIssue[] = []
  const attached = attachedMedia(input, uploads)
  for (const upload of attached) {
    if (upload.kind === 'image') continue
    const transport = resolveTransport({ preset, kind: upload.kind, remoteConfigured: ctx.remoteConfigured ?? false })
    if (transport !== 'base64') continue
    if (upload.sizeBytes > byteLimit) {
      const mb = Math.ceil(upload.sizeBytes / (1024 * 1024))
      errors.push(`Reference too large to send inline (${mb} MB, max ${MAX_INLINE_MEDIA_MB} MB)`)
    }
  }
  const lowRes = attached.some((upload) => upload.kind === 'image' && upload.width != null &&
    upload.height != null && Math.min(upload.width, upload.height) < LOW_RES_MIN_PX)
  if (lowRes) warnings.push({ type: 'text', text: 'Low resolution input, output may look soft' })
  if ((ctx.activeCount ?? 0) >= MAX_ACTIVE_JOBS) errors.push(`${MAX_ACTIVE_JOBS} videos already generating. Wait for one to finish.`)
  return { errors, warnings }
}

const REMOTE_REF_KINDS: readonly MediaKind[] = ['video', 'audio']

/** Uploads attached by the active tab, in rule order. */
function attachedMedia(input: GenerationInput, uploads: Record<string, UploadItem>): UploadItem[] {
  if (input.tab === 'references') {
    return input.references.map((id) => uploads[id]).filter((upload): upload is UploadItem => Boolean(upload))
  }
  const start = input.frames.start ? uploads[input.frames.start] : undefined
  const end = input.frames.start && input.frames.end ? uploads[input.frames.end] : undefined
  return [start, end].filter((upload): upload is UploadItem => Boolean(upload))
}

function checkRefDurations(params: CheckRefDurationsParams): void {
  const { kind, items, preset, errors } = params
  const refs = preset.references
  const min = kind === 'video' ? refs.videoMinSec : refs.audioMinSec
  const max = kind === 'video' ? refs.videoMaxSec : refs.audioMaxSec
  if (min == null && max == null) return
  items.forEach(({ durationSec: d }, index) => {
    if (d == null) return
    const label = `${kind === 'video' ? 'Video' : 'Audio'} ${index + 1}`
    if (min != null && d < min) errors.push(`${label} is ${seconds(d)}s, min ${min}s`)
    if (max != null && d > max) errors.push(`${label} is ${seconds(d)}s, max ${max}s`)
  })
}

function checkUpload(params: CheckUploadParams): UploadItem | null {
  const { id, role, uploads, errors } = params
  if (!id) return null
  const upload = uploads[id]
  if (!upload) {
    errors.push(`${role} file not found`)
    return null
  }
  if (upload.missing) errors.push(`File missing: ${upload.originalName}`)
  return upload
}
