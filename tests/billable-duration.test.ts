import { describe, expect, it } from 'vitest'
import { normalizeForPreset } from '@/core/normalize-input'
import { billableSeconds } from '@/core/pricing'
import { getPreset, minDuration } from '@/core/presets'
import type { GenerationInput } from '@/core/types'

const wan = getPreset('wan-3.0')
const prime = getPreset('wan-3.0-prime')
const seedance = getPreset('seedance-2.0')
const seedance25 = getPreset('seedance-2.5')

const draft = (presetId: string, duration: number): GenerationInput => ({
  presetId,
  tab: 'references',
  prompt: 'A cat',
  audio: true,
  duration,
  aspectRatio: '16:9',
  resolution: '1080p',
  frames: { start: null, end: null },
  references: [],
  seed: null,
})

describe('billableSeconds', () => {
  it('bills Wan at the 5 second floor', () => {
    expect(billableSeconds(wan, 2)).toBe(5)
    expect(billableSeconds(wan, 5)).toBe(5)
    expect(billableSeconds(wan, 10)).toBe(10)
  })

  it('bills Prime at the 5 second floor', () => {
    expect(billableSeconds(prime, 2)).toBe(5)
    expect(billableSeconds(prime, 10)).toBe(10)
  })

  it('bills Seedance at the requested duration', () => {
    expect(billableSeconds(seedance, 2)).toBe(2)
    expect(billableSeconds(seedance, 4)).toBe(4)
    expect(billableSeconds(seedance, 10)).toBe(10)
    expect(billableSeconds(seedance25, 2)).toBe(2)
    expect(billableSeconds(seedance25, 4)).toBe(4)
    expect(billableSeconds(seedance25, 10)).toBe(10)
  })
})

describe('minDuration', () => {
  it('raises Wan to the 5 second billing floor', () => {
    expect(minDuration(wan)).toBe(5)
    expect(minDuration(prime)).toBe(5)
  })

  it('keeps Seedance at its 4 second minimum', () => {
    expect(minDuration(seedance)).toBe(4)
    expect(minDuration(seedance25)).toBe(4)
  })
})

describe('duration normalization', () => {
  it('raises a 2s Wan draft to the floor and notes it', () => {
    const result = normalizeForPreset({ input: draft('wan-3.0', 2), preset: wan })
    expect(result.input.duration).toBe(5)
    expect(result.notes).toEqual(['Duration set to 5s'])
  })

  it('raises a 2s Seedance draft to its minimum and notes it', () => {
    const result = normalizeForPreset({ input: draft('seedance-2.0', 2), preset: seedance })
    expect(result.input.duration).toBe(4)
    expect(result.notes).toEqual(['Duration set to 4s'])
  })
})
