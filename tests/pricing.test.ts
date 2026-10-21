import { describe, expect, it } from 'vitest'
import type { ModelPreset, PresetPricing, Resolution } from '@/core/presets'
import { getPreset } from '@/core/presets'
import type { PriceContext } from '@/core/pricing'
import { formatRate, pricePerSec } from '@/core/pricing'

const wan = getPreset('wan-3.0')
const prime = getPreset('wan-3.0-prime')
const seedance = getPreset('seedance-2.0')
const seedance25 = getPreset('seedance-2.5')

const ctx = (resolution: Resolution, overrides: Partial<PriceContext> = {}): PriceContext => ({
  resolution,
  aspect: '16:9',
  audio: true,
  hasVideoInput: false,
  ...overrides,
})

const withPricing = (pricing: PresetPricing, overrides: Partial<ModelPreset> = {}): ModelPreset => ({
  ...wan,
  ...overrides,
  pricing,
})

describe('pricePerSec', () => {
  it('reads Wan USD keys', () => {
    expect(pricePerSec({ preset: wan, ctx: ctx('480p') })).toBe(0.05)
    expect(pricePerSec({ preset: wan, ctx: ctx('720p', { audio: false }) })).toBe(0.1)
    expect(pricePerSec({ preset: wan, ctx: ctx('1080p') })).toBe(0.2)
  })

  it('reads Prime fallback values', () => {
    expect(pricePerSec({ preset: prime, ctx: ctx('480p') })).toBe(0.068)
    expect(pricePerSec({ preset: prime, ctx: ctx('720p') })).toBe(0.14)
    expect(pricePerSec({ preset: prime, ctx: ctx('1080p') })).toBe(0.28)
  })

  it('divides cents by 100', () => {
    const pricing: PresetPricing = {
      kind: 'perSecond',
      unit: 'cents',
      key: () => 'per_sec',
      fallback: { per_sec: 30 },
    }
    expect(pricePerSec({ preset: withPricing(pricing), ctx: ctx('720p', { audio: false }) })).toBe(0.3)
  })

  it('passes audio only when the preset supports it', () => {
    const pricing: PresetPricing = {
      kind: 'perSecond',
      unit: 'usd',
      key: (_resolution, audio) => (audio ? 'with_audio' : 'without_audio'),
      fallback: { with_audio: 0.3, without_audio: 0.2 },
    }
    const preset = withPricing(pricing)
    expect(pricePerSec({ preset, ctx: ctx('1080p') })).toBe(0.3)
    expect(pricePerSec({ preset, ctx: ctx('1080p', { audio: false }) })).toBe(0.2)
    const silent = { ...preset, audio: { supported: false, default: false } }
    expect(pricePerSec({ preset: silent, ctx: ctx('1080p') })).toBe(0.2)
  })

  it('prefers live SKUs over the fallback', () => {
    expect(pricePerSec({ preset: wan, ctx: ctx('1080p'), skus: { duration_seconds_1080p: 0.25 } })).toBe(0.25)
  })

  it('returns null for missing or non-finite keys', () => {
    expect(pricePerSec({ preset: wan, ctx: ctx('768p') })).toBeNull()
    const pricing: PresetPricing = {
      kind: 'perSecond',
      unit: 'usd',
      key: () => 'x',
      fallback: { x: Number.NaN },
    }
    expect(pricePerSec({ preset: withPricing(pricing), ctx: ctx('1080p') })).toBeNull()
  })

  it('computes Seedance 2.0 token rates per output size', () => {
    expect(pricePerSec({ preset: seedance, ctx: ctx('720p') })).toBeCloseTo(0.1512, 6)
    expect(pricePerSec({ preset: seedance, ctx: ctx('1080p') })).toBeCloseTo(0.37422, 6)
    expect(pricePerSec({ preset: seedance, ctx: ctx('4K') })).toBeCloseTo(0.7776, 6)
    expect(pricePerSec({ preset: seedance, ctx: ctx('480p') })).toBeCloseTo(0.0672525, 6)
  })

  it('uses the video-input SKU when a video reference is attached', () => {
    expect(pricePerSec({ preset: seedance, ctx: ctx('720p', { hasVideoInput: true }) })).toBeCloseTo(0.09288, 6)
    expect(pricePerSec({ preset: seedance, ctx: ctx('1080p', { hasVideoInput: true }) })).toBeCloseTo(0.22842, 6)
  })

  it('falls back to the formula size for 9:21', () => {
    expect(pricePerSec({ preset: seedance, ctx: ctx('720p', { aspect: '9:21' }) })).toBeCloseTo(0.19845, 6)
  })

  it('uses the default ratio for auto aspect', () => {
    expect(pricePerSec({ preset: seedance, ctx: ctx('720p', { aspect: 'auto' }) })).toBeCloseTo(0.1512, 6)
  })

  it('computes Seedance 2.5 token rates', () => {
    expect(pricePerSec({ preset: seedance25, ctx: ctx('720p') })).toBeCloseTo(0.23112, 6)
    expect(pricePerSec({ preset: seedance25, ctx: ctx('480p') })).toBeCloseTo(0.1028, 6)
    expect(pricePerSec({ preset: seedance25, ctx: ctx('720p', { hasVideoInput: true }) })).toBeCloseTo(0.13824, 6)
  })
})

describe('formatRate', () => {
  it('uses two decimals when the third is zero', () => {
    expect(formatRate(0.05)).toBe('$0.05/s')
    expect(formatRate(1)).toBe('$1.00/s')
  })

  it('keeps three decimals when needed', () => {
    expect(formatRate(0.068)).toBe('$0.068/s')
  })
})
