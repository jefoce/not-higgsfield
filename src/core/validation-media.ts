import { KIND_TITLE } from './media-kinds'
import type { ModelPreset } from './presets'
import type { UploadItem } from './types'

const MB = 1024 * 1024

/** Whole seconds stay plain, fractions keep one decimal. */
export const seconds = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)))

const joinOr = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`

const formatRatio = (ratio: number): string => String(Number(ratio.toFixed(1)))

interface CheckReferenceLimitsParams {
  upload: UploadItem
  preset: ModelPreset
  errors: string[]
}

/** Per-kind size, aspect and format checks that only need upload metadata. */
export function checkReferenceLimits(params: CheckReferenceLimitsParams): void {
  const { upload, preset, errors } = params
  const limits = preset.referenceLimits?.[upload.kind]
  if (!limits) return
  const title = KIND_TITLE[upload.kind]
  const name = upload.originalName
  const ext = upload.ext.replace(/^\./, '').toLowerCase()

  if (limits.formats?.length && !limits.formats.includes(ext)) {
    errors.push(`${preset.title} takes ${upload.kind} references as ${joinOr(limits.formats)} (${name})`)
  }
  if (upload.width != null && upload.height != null) {
    const short = Math.min(upload.width, upload.height)
    const long = Math.max(upload.width, upload.height)
    if (limits.minSidePx != null && short < limits.minSidePx) {
      errors.push(`${title} too small: ${short} px, min ${limits.minSidePx} px (${name})`)
    }
    if (limits.maxSidePx != null && long > limits.maxSidePx) {
      errors.push(`${title} too large: ${long} px, max ${limits.maxSidePx} px (${name})`)
    }
    if (limits.maxAspect != null && short > 0 && long / short > limits.maxAspect) {
      errors.push(`${title} too narrow: ${formatRatio(long / short)}:1, max ${limits.maxAspect}:1 (${name})`)
    }
  }
  if (limits.maxBytes != null && upload.sizeBytes > limits.maxBytes) {
    errors.push(`${title} file too large: ${Math.round(upload.sizeBytes / MB)} MB, max ${Math.round(limits.maxBytes / MB)} MB (${name})`)
  }
}
