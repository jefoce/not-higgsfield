import type { MediaKind } from '../media-types'
import type { VideoProviderId } from '../providers/types'

export const RESOLUTIONS = ['480p', '720p', '768p', '1080p', '2K', '4K'] as const
export type Resolution = (typeof RESOLUTIONS)[number]

export const ASPECT_RATIOS = [
  '21:9',
  '16:9',
  '3:2',
  '4:3',
  '1:1',
  '3:4',
  '2:3',
  '9:16',
  '9:21',
] as const

export type AspectRatio = (typeof ASPECT_RATIOS)[number]
export type AspectChoice = AspectRatio | 'auto'

/** @public */
export type Transport = 'base64' | 'url' | 'auto'

/** @public */
export interface TransportByKind {
  image: Transport
  video: Transport
  audio: Transport
}

type PresetFamily = 'wan' | 'seedance'

type PresetIcon = 'sparkles' | 'audio-lines'

export interface ReferenceLimits {
  maxBytes?: number
  minSidePx?: number
  maxSidePx?: number

  /** Lowercase extensions, no dot. */
  formats?: readonly string[]

  /** Long side / short side. */
  maxAspect?: number

  /** Model keeps transparency in a PNG. False means flatten before JPEG. */
  alpha?: boolean
}

export type SkuTable = Readonly<Record<string, number>>
export type ResolutionTiers = Readonly<Partial<Record<Resolution, string>>>

export interface SkuContext {
  resolution: Resolution
  audio: boolean
  hasVideoInput: boolean
}

export interface SkuCondition {
  hasVideoInput?: boolean
  audio?: boolean
  hasTier?: boolean
}

/** First rule whose every set condition matches wins. `{resolution}` and `{tier}` are replaced. */
export interface SkuRule {
  when: SkuCondition
  key: string
}

export interface PerSecondPricing {
  kind: 'perSecond'
  unit: 'usd' | 'cents'
  skuRules: readonly SkuRule[]
  tiers: ResolutionTiers
  fallback: SkuTable
  minBillableSec: number

  /** Billed reference-video seconds per input second. */
  referenceVideoFactor: number
}

export interface VideoTokenPricing {
  kind: 'videoTokens'
  fps: number
  skuRules: readonly SkuRule[]
  tiers: ResolutionTiers
  fallback: SkuTable
  minBillableSec: number

  /** Billed reference-video seconds per input second. */
  referenceVideoFactor: number
}

export type PricingRule = PerSecondPricing | VideoTokenPricing

export interface ProviderBinding {
  provider: VideoProviderId
  modelId: string
  pricing: PricingRule
  transport: TransportByKind
}

export interface ModelPreset {
  id: string
  title: string
  family: PresetFamily

  /** Key the picker maps to a lucide icon. */
  icon: PresetIcon
  duration: { min: number; max: number; default: number; options?: readonly number[] }

  aspectRatios: readonly AspectRatio[]
  defaultAspectRatio: AspectRatio
  autoAspectWithFrames: boolean

  /** False until a real run proves the model accepts an empty prompt. */
  promptOptional: boolean
  resolutions: readonly Resolution[]
  defaultResolution: Resolution
  audio: { supported: boolean; default: boolean }
  frames: { start: boolean; end: boolean }
  references: {
    image: number
    video: number
    audio: number
    videoTotalSec: number
    audioTotalSec: number
    videoMinSec?: number
    videoMaxSec?: number
    audioMinSec?: number
    audioMaxSec?: number
    audioNeedsVisual?: boolean
  }
  referenceLimits?: Partial<Record<MediaKind, ReferenceLimits>>
  maxInputPlusOutputSec: number | null
  promptMaxChars: number
  seed: boolean
  refLabel: string
  outputSizes?: Partial<Record<Resolution, Partial<Record<AspectRatio, `${number}x${number}`>>>>
  bindings: readonly [ProviderBinding, ...ProviderBinding[]]
}
