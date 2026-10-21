import { outputSize } from './output-size'
import type { AspectChoice, ModelPreset, Resolution } from './presets'

export interface PriceContext {
  resolution: Resolution
  aspect: AspectChoice
  audio: boolean
  hasVideoInput: boolean
}

interface PricePerSecParams {
  preset: ModelPreset
  ctx: PriceContext
  skus?: Record<string, number>
}

/** Per-second rate in USD, or null when the SKU is missing. */
export function pricePerSec(params: PricePerSecParams): number | null {
  const { preset, ctx, skus } = params
  const table = skus ?? preset.pricing.fallback
  const audio = ctx.audio && preset.audio.supported

  if (preset.pricing.kind === 'perSecond') {
    const raw = table[preset.pricing.key(ctx.resolution, audio)]
    if (raw == null || !Number.isFinite(raw)) return null
    return preset.pricing.unit === 'cents' ? raw / 100 : raw
  }

  const raw = table[preset.pricing.key(ctx.resolution, audio, ctx.hasVideoInput)]
  if (raw == null || !Number.isFinite(raw)) return null
  const aspect = ctx.aspect === 'auto' ? preset.defaultAspectRatio : ctx.aspect
  const size = outputSize({ preset, resolution: ctx.resolution, aspect: aspect })
  if (!size) return null
  return ((size.width * size.height * preset.pricing.fps) / 1024) * raw
}

/** Seconds the provider bills, honoring the preset floor. */
export function billableSeconds(preset: ModelPreset, duration: number): number {
  return Math.max(preset.minBillableSec ?? 0, duration)
}

export function estimateUsd(rate: number, duration: number): number {
  return rate * duration
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`
}

export function formatEstimate(value: number): string {
  return `\u2248 ${formatUsd(value)}`
}

export function formatRate(value: number): string {
  const decimals = Math.round(value * 1000) % 10 === 0 ? 2 : 3
  return `$${value.toFixed(decimals)}/s`
}
