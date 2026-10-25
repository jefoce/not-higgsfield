import type { AspectChoice, Resolution } from './presets/types'
import type { GenerationRecord, GeneratorTab, JobStatus } from './schemas/generation-record'
import type { SecretName } from './secret-names'

/** Start and end frame data URLs. */
export interface FrameSlots {
  start: string | null
  end: string | null
}

export const ACTIVE_STATUSES: JobStatus[] = ['submitting', 'pending', 'in_progress']

/** One id a batch route could not act on, with the reason. */
export interface BatchSkip {
  id: string
  reason: 'not_found' | 'active' | 'not_ready'
}

export interface HistoryFilters {
  q?: string
  model?: string
  favorite?: boolean
  status?: 'all' | 'done' | 'active' | 'failed'
  tab?: GeneratorTab | 'all'
  mode?: 'all' | 'text' | 'frames' | 'references'
  resolution?: Resolution | 'all'
  aspect?: AspectChoice | 'all'
  audio?: 'any' | 'on' | 'off'
}

export interface GenerationListResult {
  items: GenerationRecord[]
  nextCursor: string | null
  activeCount: number
}

export interface CreditsInfo {
  balance: number | null
  keyLimitRemaining: number | null
  keyLimit: number | null
  usageDaily: number | null
  usageMonthly: number | null
  localSpent: number
  source: 'management' | 'key' | 'mock' | 'none'
  fetchedAt: string
  error?: string
}

/** OS dialog support for the current server. */
export interface SystemCapabilities {
  chooseFiles: boolean
  chooseFolder: boolean
  platform: string
}

export type SecretSource = 'env' | 'keychain' | 'file'

export interface SecretKeyStatus {
  set: boolean
  source: SecretSource | null
  hint: string | null
}

/** Stored key status, without values. */
export interface SecretStatus {
  backend: 'keychain' | 'file' | null
  loading: boolean
  loadError: string | null
  keys: Record<SecretName, SecretKeyStatus>
}

/** Server price for one draft, discounted and at list. */
export interface GenerationEstimate {
  estimatedUsd: number
  listUsd: number
  pricePerSec: number
  priceSource: 'live' | 'fallback' | 'mock' | 'unknown'
  discount: number
}

/** Live and list SKU rates for one preset. */
export interface PricingInfo {
  skus: Record<string, number>
  listSkus: Record<string, number>
  discount: number
  source: 'live' | 'fallback' | 'mock'
  fetchedAt: string
}

/** Result of a stored credential test. */
export interface TestResult {
  ok: boolean
  mock?: boolean
  label?: string
  error?: string
}
