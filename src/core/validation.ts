import { z } from 'zod'
import { SEED_MAX } from './constants'
import { KIND_PLURAL } from './media-kinds'
import { slotLabel } from './prompt-tokens'
import { minDuration, type ModelPreset } from './presets'
import type { GenerationInput, UploadItem } from './types'
import { validateFrames, validateLimits, validatePrompt, validateReferences } from './validation-rules'
import type {
  RuleResult,
  ValidationContext,
  ValidationIssue,
  ValidationResult,
} from './validation-types'

export { maxDurationFor } from './duration-limits'
export type { ValidationIssue, ValidationResult } from './validation-types'

/** Exact display text for a warning. */
export function issueText(issue: ValidationIssue): string {
  if (issue.type === 'text') return issue.text
  return `@${slotLabel(issue.slot)} is not attached (${issue.attached} ${KIND_PLURAL[issue.slot.kind]})`
}

function durationSchema(preset: ModelPreset) {
  const min = minDuration(preset)
  const schema = z.number().int().min(min, { message: `Minimum ${min}s` })
  const options = preset.duration.options
  if (options) return schema.refine((value) => options.includes(value), { message: 'Duration is not allowed' })
  return schema.max(preset.duration.max)
}

export function buildInputSchema(preset: ModelPreset) {
  return z.object({
    presetId: z.string(),
    tab: z.enum(['frames', 'references']),
    prompt: z.string().max(preset.promptMaxChars),
    audio: z.boolean(),
    duration: durationSchema(preset),
    aspectRatio: z.enum([...preset.aspectRatios, 'auto']),
    resolution: z.enum(preset.resolutions),
    frames: z.object({ start: z.string().nullable(), end: z.string().nullable() }),
    references: z.array(z.string()),
    seed: z.number().int().min(0).max(SEED_MAX).nullable(),
  })
}

interface ValidateInputParams {
  input: GenerationInput
  uploads: Record<string, UploadItem>
  preset: ModelPreset
  ctx?: ValidationContext
}

export function validateInput(params: ValidateInputParams): ValidationResult {
  const { input, uploads, preset, ctx = {} } = params
  const parsed = buildInputSchema(preset).safeParse(input)
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    return { ok: false, errors, warnings: [] }
  }

  const groups: RuleResult[] = [
    validatePrompt(input, preset),
    validateFrames({ input, uploads, preset }),
    validateReferences({ input, uploads, preset, ctx }),
    validateLimits({ input, uploads, preset, ctx }),
  ]
  const errors = groups.flatMap((group) => group.errors)
  const warnings = groups.flatMap((group) => group.warnings)
  return { ok: errors.length === 0, errors, warnings }
}
