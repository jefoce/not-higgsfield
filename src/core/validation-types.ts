import type { ModelStatus } from '@/server/services/model-catalog'

import type { UploadItem } from './media-types'
import type { ModelPreset } from './presets/types'
import type { RefSlot } from './prompt-tokens'
import type { GenerationInput } from './types'

export interface MissingSlotIssue {
  type: 'missing-slot'
  slot: RefSlot
  attached: number
}

export interface TextIssue {
  type: 'text'
  text: string
}

export type ValidationIssue = MissingSlotIssue | TextIssue

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: ValidationIssue[]
}

/** Errors and warnings from one validation rule group. */
export interface RuleResult {
  errors: string[]
  warnings: ValidationIssue[]
}

export interface ValidationContext {
  activeCount?: number
  remoteConfigured?: boolean
  modelStatus?: ModelStatus
  modelReason?: string | null
}

export interface ValidateFramesParams {
  input: GenerationInput
  uploads: Record<string, UploadItem>
  preset: ModelPreset
}

export interface ValidateWithContextParams extends ValidateFramesParams {
  ctx: ValidationContext
}
