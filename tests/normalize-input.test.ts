import { describe, expect, it } from 'vitest'
import { inputForSubmit, normalizeForPreset } from '@/core/normalize-input'
import { getPreset } from '@/core/presets'
import type { ModelPreset } from '@/core/presets'
import type { GenerationInput, MediaKind, UploadItem } from '@/core/types'

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    presetId: 'wan-3.0',
    tab: 'references',
    prompt: 'A cat',
    audio: true,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    frames: { start: 'start', end: 'end' },
    references: ['ref'],
    seed: 7,
    ...overrides,
  }
}

function upload(id: string, kind: MediaKind, overrides: Partial<UploadItem> = {}): UploadItem {
  return {
    id,
    source: 'file',
    kind,
    mime: '',
    ext: '',
    originalName: id,
    sizeBytes: 0,
    createdAt: '2026-10-20T00:00:00.000Z',
    ...overrides,
  }
}

const uploadsOf = (...items: UploadItem[]): Record<string, UploadItem> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

const wan = getPreset('wan-3.0')

const withPreset = (overrides: Partial<ModelPreset>): ModelPreset => ({ ...wan, ...overrides })

describe('inputForSubmit', () => {
  it('drops references on the frames tab', () => {
    const result = inputForSubmit(input({ tab: 'frames' }))
    expect(result.references).toEqual([])
  })

  it('keeps start only when no end frame is set', () => {
    const result = inputForSubmit(
      input({ tab: 'frames', frames: { start: 'start', end: null } }),
    )
    expect(result.frames).toEqual({ start: 'start', end: null })
  })

  it('keeps both frames', () => {
    expect(inputForSubmit(input({ tab: 'frames' })).frames).toEqual({
      start: 'start',
      end: 'end',
    })
  })

  it('clears frames on the references tab', () => {
    const result = inputForSubmit(input())
    expect(result.frames).toEqual({ start: null, end: null })
    expect(result.references).toEqual(['ref'])
  })

  it('does not mutate and preserves other fields', () => {
    const original = input({ tab: 'frames' })
    const result = inputForSubmit(original)
    expect(original.frames).toEqual({ start: 'start', end: 'end' })
    expect(original.references).toEqual(['ref'])
    expect(result).not.toBe(original)
    expect(result).toMatchObject({
      presetId: 'wan-3.0',
      prompt: 'A cat',
      audio: true,
      duration: 5,
      aspectRatio: '16:9',
      resolution: '1080p',
      seed: 7,
    })
  })
})

describe('normalizeForPreset', () => {
  it('sets the preset id and leaves compatible input untouched', () => {
    const result = normalizeForPreset({ input: input({ presetId: 'other', references: [] }), preset: wan })
    expect(result.input.presetId).toBe('wan-3.0')
    expect(result.notes).toEqual([])
  })

  it('clamps duration when the preset has no options', () => {
    const preset = withPreset({ duration: { min: 2, max: 30, default: 5 } })
    const result = normalizeForPreset({ input: input({ duration: 90 }), preset: preset })
    expect(result.input.duration).toBe(30)
    expect(result.notes).toEqual(['Duration set to 30s'])
  })

  it('snaps duration to the nearest option', () => {
    const preset = withPreset({ duration: { min: 4, max: 8, default: 6, options: [4, 6, 8] } })
    expect(normalizeForPreset({ input: input({ duration: 5.5 }), preset: preset }).input.duration).toBe(6)
    expect(normalizeForPreset({ input: input({ duration: 5.5 }), preset: preset }).notes).toEqual(['Duration set to 6s'])
    expect(normalizeForPreset({ input: input({ duration: 8 }), preset: preset }).notes).toEqual([])
  })

  it('resets unsupported resolution and aspect ratio', () => {
    const result = normalizeForPreset({ input: input({ resolution: '4K', aspectRatio: '21:9' }), preset: wan })
    expect(result.input.resolution).toBe('1080p')
    expect(result.input.aspectRatio).toBe('16:9')
  })

  it('keeps auto only when frames allow it', () => {
    expect(normalizeForPreset({ input: input({ aspectRatio: 'auto' }), preset: wan }).input.aspectRatio).toBe('auto')
    const noAuto = withPreset({ autoAspectWithFrames: false })
    expect(normalizeForPreset({ input: input({ aspectRatio: 'auto' }), preset: noAuto }).input.aspectRatio).toBe('16:9')
  })

  it('turns audio off when the preset does not support it', () => {
    const silent = withPreset({ audio: { supported: false, default: false } })
    expect(normalizeForPreset({ input: input({ audio: true }), preset: silent }).input.audio).toBe(false)
  })

  it('clears the end frame when unsupported', () => {
    const noEnd = withPreset({ frames: { start: true, end: false } })
    const result = normalizeForPreset({ input: input({ frames: { start: 'start', end: 'end' } }), preset: noEnd })
    expect(result.input.frames).toEqual({ start: 'start', end: null })
  })

  it('clears both frames without a start frame', () => {
    const result = normalizeForPreset({ input: input({ frames: { start: null, end: 'end' } }), preset: wan })
    expect(result.input.frames).toEqual({ start: null, end: null })
  })

  it('switches to frames when references are unsupported and keeps the list', () => {
    const noRefs = withPreset({
      references: { image: 0, video: 0, audio: 0, videoTotalSec: 0, audioTotalSec: 0 },
    })
    const result = normalizeForPreset({ input: input({ tab: 'references', references: ['ref'] }), preset: noRefs })
    expect(result.input.tab).toBe('frames')
    expect(result.input.references).toEqual(['ref'])
    expect(result.notes).toEqual(['References not supported by Wan 3.0'])
  })

  it('trims references per kind in order', () => {
    const preset = withPreset({
      references: { image: 1, video: 1, audio: 1, videoTotalSec: 15, audioTotalSec: 15 },
    })
    const result = normalizeForPreset({ input: input({ references: ['i1', 'i2', 'v1', 'v2', 'a1', 'a2'] }), preset, uploads: uploadsOf(
        upload('i1', 'image'),
        upload('i2', 'image'),
        upload('v1', 'video'),
        upload('v2', 'video'),
        upload('a1', 'audio'),
        upload('a2', 'audio'),
      ) }
    )
    expect(result.input.references).toEqual(['i1', 'v1', 'a1'])
    expect(result.notes).toEqual([
      'Removed 1 image reference',
      'Removed 1 video reference',
      'Removed 1 audio reference',
    ])
  })

  it('normalizes a Wan draft for Seedance 2.0', () => {
    const seedance = getPreset('seedance-2.0')
    const images = Array.from({ length: 10 }, (_, i) => `i${i}`)
    const uploads = uploadsOf(
      ...images.map((id) => upload(id, 'image')),
      upload('v', 'video', { durationSec: 10 }),
      upload('a', 'audio', { durationSec: 3 }),
    )
    const result = normalizeForPreset({ input: input({
        duration: 30,
        resolution: '768p',
        aspectRatio: '21:9',
        references: [...images, 'v', 'a'],
      }), preset: seedance, uploads: uploads }
    )

    expect(result.input.presetId).toBe('seedance-2.0')
    expect(result.input.duration).toBe(15)
    expect(result.input.resolution).toBe('720p')
    expect(result.input.aspectRatio).toBe('21:9')
    expect(result.input.references).toEqual([...images.slice(0, 9), 'v', 'a'])
    expect(result.notes).toEqual([
      'Removed 1 image reference',
      'Duration set to 15s',
      'Resolution set to 720p',
    ])
  })

  it('resets 9:21 on Seedance 2.0 away from 720p with a note', () => {
    const seedance = getPreset('seedance-2.0')
    const hd = normalizeForPreset({ input: input({ aspectRatio: '9:21', resolution: '1080p' }), preset: seedance })
    expect(hd.input.aspectRatio).toBe('16:9')
    expect(hd.notes).toContain('Aspect set to 16:9')
    const wide = normalizeForPreset({ input: input({ aspectRatio: '9:21', resolution: '720p' }), preset: seedance })
    expect(wide.input.aspectRatio).toBe('9:21')
    expect(wide.notes).not.toContain('Aspect set to 16:9')
  })

  it('caps duration by the total reference video time', () => {
    const result = normalizeForPreset({ input: input({ duration: 20, references: ['v1', 'v2'] }), preset: wan, uploads: uploadsOf(
        upload('v1', 'video', { durationSec: 7 }),
        upload('v2', 'video', { durationSec: 7 }),
      ) }
    )
    expect(result.input.duration).toBe(15)
    expect(result.notes).toContain('Duration set to 15s')
  })

  it('ignores video references when the combined rule is off', () => {
    const seedance = getPreset('seedance-2.0')
    const result = normalizeForPreset({ input: input({ duration: 30, references: ['v'] }), preset: seedance, uploads: uploadsOf(upload('v', 'video', { durationSec: 10 })) }
    )
    expect(result.input.duration).toBe(15)
  })

  it('keeps the seed', () => {
    expect(normalizeForPreset({ input: input({ seed: 42 }), preset: wan }).input.seed).toBe(42)
  })

  it('keeps unknown references on reload until kinds load', () => {
    const seedance = getPreset('seedance-2.0')
    const ids = [
      ...Array.from({ length: 9 }, (_, i) => `i${i}`),
      ...Array.from({ length: 3 }, (_, i) => `v${i}`),
      ...Array.from({ length: 3 }, (_, i) => `a${i}`),
    ]
    const result = normalizeForPreset({ input: input({ presetId: 'seedance-2.0', references: ids }), preset: seedance, uploads: {} }
    )
    expect(result.input.references).toEqual(ids)
    expect(result.notes).toEqual([])
  })

  it('keeps all 15 mixed references once kinds are known', () => {
    const seedance = getPreset('seedance-2.0')
    const ids = [
      ...Array.from({ length: 9 }, (_, i) => `i${i}`),
      ...Array.from({ length: 3 }, (_, i) => `v${i}`),
      ...Array.from({ length: 3 }, (_, i) => `a${i}`),
    ]
    const uploads = uploadsOf(
      ...Array.from({ length: 9 }, (_, i) => upload(`i${i}`, 'image')),
      ...Array.from({ length: 3 }, (_, i) => upload(`v${i}`, 'video', { durationSec: 5 })),
      ...Array.from({ length: 3 }, (_, i) => upload(`a${i}`, 'audio', { durationSec: 3 })),
    )
    const result = normalizeForPreset({ input: input({ presetId: 'seedance-2.0', references: ids }), preset: seedance, uploads: uploads }
    )
    expect(result.input.references).toEqual(ids)
    expect(result.notes).toEqual([])
  })

  it('drops the tenth image when the preset image limit is nine', () => {
    const seedance = getPreset('seedance-2.0')
    const ids = Array.from({ length: 10 }, (_, i) => `i${i}`)
    const result = normalizeForPreset({ input: input({ presetId: 'seedance-2.0', references: ids }), preset: seedance, uploads: uploadsOf(...ids.map((id) => upload(id, 'image'))) }
    )
    expect(result.input.references).toEqual(ids.slice(0, 9))
    expect(result.notes).toEqual(['Removed 1 image reference'])
  })

  it('is idempotent and does not mutate the draft', () => {
    const original = input({ duration: 90, references: ['i1', 'i2'] })
    const preset = withPreset({
      references: { image: 1, video: 0, audio: 0, videoTotalSec: 0, audioTotalSec: 0 },
    })
    const first = normalizeForPreset({ input: original, preset, uploads: uploadsOf(upload('i1', 'image'), upload('i2', 'image')) })
    const second = normalizeForPreset({ input: first.input, preset, uploads: uploadsOf(upload('i1', 'image'), upload('i2', 'image')) })

    expect(second.input).toEqual(first.input)
    expect(second.notes).toEqual([])
    expect(original.duration).toBe(90)
    expect(original.references).toEqual(['i1', 'i2'])
  })
})
