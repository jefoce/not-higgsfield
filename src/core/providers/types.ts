import type { HttpRuleTable } from '../provider-errors/types'
import type { SecretName } from '../secret-names'

/** @public */
export const VIDEO_PROVIDER_IDS = ['openrouter'] as const

export type VideoProviderId = (typeof VIDEO_PROVIDER_IDS)[number]

/** @public */
export const STORAGE_PROVIDER_IDS = ['r2'] as const

export type StorageProviderId = (typeof STORAGE_PROVIDER_IDS)[number]

/** @public */
export interface ProviderSecretField {
  name: SecretName
  label: string
  placeholder: string
  isSecret: boolean
  hint: string | null
}

/** @public */
export interface ProviderLinks {
  keys: string
  credits: string | null
  docs: string
}

export interface VideoProviderDescriptor {
  id: VideoProviderId
  label: string
  fields: readonly ProviderSecretField[]
  requiredSecrets: readonly SecretName[]
  links: ProviderLinks
  httpRules: HttpRuleTable
}

export interface StorageProviderDescriptor {
  id: StorageProviderId
  label: string
  fields: readonly ProviderSecretField[]
  requiredSecrets: readonly SecretName[]
  links: ProviderLinks
}
