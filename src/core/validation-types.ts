import type { RefSlot } from './prompt-tokens'

export type ValidationIssue =
  | { type: 'missing-slot'; slot: RefSlot; attached: number }
  | { type: 'text'; text: string }

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
}
