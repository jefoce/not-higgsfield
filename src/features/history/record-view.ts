import { PREVIEW_WIDTH } from '@/core/constants'
import { findPreset } from '@/core/presets'
import { canonicalizePrompt, referenceSlots, type RefSlot, type SlotCounts } from '@/core/prompt-tokens'
import { friendlyError, type FriendlyError } from '@/core/provider-errors'
import type { GenerationRecord } from '@/core/types'
import { thumbUrl } from '@/features/media-picker/api'

const SELECTABLE_STATUSES: readonly GenerationRecord['status'][] = [
  'completed',
  'failed',
  'cancelled',
  'expired',
]

/** Only terminal records can be selected; active work cannot be acted on. */
export function isSelectable(record: GenerationRecord): boolean {
  return SELECTABLE_STATUSES.includes(record.status)
}

/** Friendly error for a record, or null when there is no raw text. */
export function recordError(record: GenerationRecord): FriendlyError | null {
  if (!record.error) return null
  return friendlyError({
    raw: record.error,
    family: findPreset(record.input.presetId)?.family ?? null,
  })
}

/** Aspect truth: output size, then start frame size, then selected ratio. */
export function recordAspect(record: GenerationRecord): string {
  const output = record.output
  if (output?.width && output.height) return `${output.width}/${output.height}`
  const start = record.input.frames.start
  const frame = start ? record.inputsSnapshot[start] : undefined
  if (frame?.width && frame?.height) return `${frame.width}/${frame.height}`
  if (record.input.aspectRatio !== 'auto') return record.input.aspectRatio.replace(':', '/')
  return '16/9'
}

export const videoSrc = (record: GenerationRecord): string =>
  `/api/media/downloads/${record.output?.video ?? `${record.id}.mp4`}`

/** Poster thumb at a bucket width; defaults to the full preview size. */
export function posterSrc(record: GenerationRecord, widthPx = PREVIEW_WIDTH): string | undefined {
  const preview = record.output?.preview
  return preview ? thumbUrl({ ref: `downloads/${preview}`, w: widthPx }) : undefined
}

export const uploadThumb = (id: string, width = 160): string =>
  `/api/thumbs/uploads/${id}?w=${width}`

/** Reference counts and slot positions from the record snapshot order. */
export function recordSlots(record: GenerationRecord): {
  counts: SlotCounts
  slots: Map<string, RefSlot>
} {
  return referenceSlots(record.input.references, (id) => record.inputsSnapshot[id]?.kind)
}

/** Reference counts by kind for a record prompt. */
export function recordCounts(record: GenerationRecord): SlotCounts {
  return recordSlots(record).counts
}

/** Stored prompt canonicalized to positional slots. */
export function canonicalPrompt(record: GenerationRecord): string {
  return canonicalizePrompt(record.input.prompt, recordCounts(record))
}

/** Prompt copy text: canonical slots, no ids. */
export function plainPrompt(record: GenerationRecord): string {
  return canonicalPrompt(record)
}
