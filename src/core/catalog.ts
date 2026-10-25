import type { VideoProviderId } from './providers/types'
import type { PricingInfo } from './types'

export type ModelStatus = 'available' | 'unverified' | 'missing' | 'no_provider'

export interface CatalogEntry {
  modelId: string
  presetId: string
  provider: VideoProviderId | null
  status: ModelStatus
  reason: string | null
  pricing: PricingInfo | null
}

export interface ModelCatalog {
  entries: readonly CatalogEntry[]
  fetchedAt: string
}
