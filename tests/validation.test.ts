import { describe, expect, it } from 'vitest'
import { getPreset, minDuration, type Resolution } from '@/core/presets'
import type { GenerationInput, MediaKind, UploadItem } from '@/core/types'
import { issueText, maxDurationFor, validateInput, type ValidationIssue } from '@/core/validation'

const preset = getPreset('wan-3.0')
const mb = 1024 * 1024

function upload(id: string, kind: MediaKind, overrides: Partial<UploadItem> = {}): UploadItem {
  const ext = kind === 'image' ? '.png' : kind === 'video' ? '.mp4' : '.mp3'
  const mime = kind === 'image' ? 'image/png' : kind === 'video' ? 'video/mp4' : 'audio/mpeg'
  return {
    id,
    source: 'file',
    kind,
    mime,
    ext,
    originalName: `${id}${ext}`,
    sizeBytes: 1024,
    createdAt: '2026-10-20T00:00:00.000Z',
    ...overrides,
  }
}

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    presetId: preset.id,
    tab: 'references',
    prompt: 'A cat',
    audio: true,
    duration: 5,
    aspectRatio: '16:9',
    resolution: '1080p',
    frames: { start: null, end: null },
    references: [],
    seed: null,
    ...overrides,
  }
}

function uploadsOf(...items: UploadItem[]): Record<string, UploadItem> {
  return Object.fromEntries(items.map((item) => [item.id, item]))
}

describe('validateInput', () => {
  it('accepts a text-only references job', () => {
    const result = validateInput({ input: input(), uploads: {}, preset: preset })
    expect(result).toEqual({ ok: true, errors: [], warnings: [] })
  })

  it('requires a prompt with a start frame by default', () => {
    const result = validateInput({ input: input({
        tab: 'frames',
        prompt: '',
        aspectRatio: 'auto',
        frames: { start: 'start', end: null },
      }), uploads: uploadsOf(upload('start', 'image')), preset: preset }
    )
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Prompt is required')
  })

  it('accepts an empty prompt when the preset marks it optional and a start frame exists', () => {
    const optional = { ...preset, promptOptional: true }
    const result = validateInput({ input: input({
        tab: 'frames',
        prompt: '',
        aspectRatio: 'auto',
        frames: { start: 'start', end: null },
      }), uploads: uploadsOf(upload('start', 'image')), preset: optional }
    )
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects an empty prompt with an optional preset and no start frame', () => {
    const optional = { ...preset, promptOptional: true }
    const result = validateInput({ input: input({ tab: 'frames', prompt: '', aspectRatio: 'auto', frames: { start: null, end: null } }), uploads: {}, preset: optional }
    )
    expect(result.errors).toContain('Prompt is required')
  })

  it('accepts a references job with mixed kinds', () => {
    const uploads = uploadsOf(
      upload('img', 'image'),
      upload('vid', 'video', { durationSec: 5 }),
      upload('aud', 'audio', { durationSec: 3 }),
    )
    const result = validateInput({ input: input({
        prompt: 'The woman from @Image 1 walks with @Video 1.',
        references: ['img', 'vid', 'aud'],
      }), uploads, preset, ctx: { remoteConfigured: true } }
    )
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects a non-integer or out-of-range duration', () => {
    const low = validateInput({ input: input({ duration: 1 }), uploads: {}, preset: preset })
    const fractional = validateInput({ input: input({ duration: 5.5 }), uploads: {}, preset: preset })
    const high = validateInput({ input: input({ duration: 31 }), uploads: {}, preset: preset })
    expect(low.ok).toBe(false)
    expect(low.errors[0]).toContain('duration')
    expect(fractional.ok).toBe(false)
    expect(high.ok).toBe(false)
  })

  it('rejects a duration below the billing floor', () => {
    const wanLow = validateInput({ input: input({ duration: 2 }), uploads: {}, preset: preset })
    expect(wanLow.ok).toBe(false)
    expect(wanLow.errors).toContain('duration: Minimum 5s')

    const seedance = getPreset('seedance-2.0')
    const seedanceLow = validateInput({ input: input({ presetId: seedance.id, duration: 2 }), uploads: {}, preset: seedance })
    expect(seedanceLow.ok).toBe(false)
    expect(seedanceLow.errors).toContain('duration: Minimum 4s')
  })

  it('rejects a duration outside the preset options', () => {
    const optionPreset = {
      ...preset,
      duration: { min: 4, max: 8, default: 6, options: [4, 6, 8] as const },
    }
    expect(validateInput({ input: input({ duration: 6 }), uploads: {}, preset: optionPreset }).ok).toBe(true)
    const result = validateInput({ input: input({ duration: 5 }), uploads: {}, preset: optionPreset })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('duration')
  })

  it('rejects an unsupported resolution', () => {
    const result = validateInput({ input: input({ resolution: '4k' as Resolution }), uploads: {}, preset: preset })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('resolution')
  })

  it('accepts resolutions from the new enum', () => {
    const wide = { ...preset, resolutions: ['720p', '4K'] as const, defaultResolution: '4K' as const }
    expect(validateInput({ input: input({ resolution: '4K' }), uploads: {}, preset: wide }).ok).toBe(true)
  })

  it('accepts image references on Wan Prime', () => {
    const result = validateInput({ input: input({ presetId: 'wan-3.0-prime', references: ['img'] }), uploads: uploadsOf(upload('img', 'image')), preset: getPreset('wan-3.0-prime') }
    )
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('allows Seedance 2.0 9:21 only at 720p', () => {
    const seedance = getPreset('seedance-2.0')
    const wide = validateInput({ input: input({ presetId: seedance.id, aspectRatio: '9:21', resolution: '720p' }), uploads: {}, preset: seedance })
    expect(wide.ok).toBe(true)
    const hd = validateInput({ input: input({ presetId: seedance.id, aspectRatio: '9:21', resolution: '1080p' }), uploads: {}, preset: seedance })
    expect(hd.errors).toContain('Aspect 9:21 is only available at 720p')
  })

  it('rejects auto aspect on the references tab', () => {
    const result = validateInput({ input: input({ aspectRatio: 'auto' }), uploads: {}, preset: preset })
    expect(result.errors).toContain('Auto aspect ratio needs a start frame')
  })

  it('requires a prompt without a start frame', () => {
    const result = validateInput({ input: input({ prompt: '   ' }), uploads: {}, preset: preset })
    expect(result.errors).toContain('Prompt is required')
  })

  it('rejects a prompt over preset.promptMaxChars', () => {
    const result = validateInput({ input: input({ prompt: 'a'.repeat(preset.promptMaxChars + 1) }), uploads: {}, preset: preset })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('prompt')
  })

  it('rejects an end frame without a start frame', () => {
    const result = validateInput({ input: input({ tab: 'frames', prompt: '', frames: { start: null, end: 'end' } }), uploads: uploadsOf(upload('end', 'image')), preset: preset }
    )
    expect(result.errors).toContain('Add a start frame first')
  })

  it('rejects an end frame when the preset disables it', () => {
    const noEnd = { ...preset, frames: { start: true, end: false } }
    const result = validateInput({ input: input({ tab: 'frames', prompt: '', frames: { start: 'start', end: 'end' } }), uploads: uploadsOf(upload('start', 'image'), upload('end', 'image')), preset: noEnd }
    )
    expect(result.errors).toContain('End frame is not supported by this model')
  })

  it('rejects a frame upload id that does not exist', () => {
    const result = validateInput({ input: input({ tab: 'frames', prompt: '', frames: { start: 'missing', end: null } }), uploads: {}, preset: preset }
    )
    expect(result.errors).toContain('Start frame file not found')
  })

  it('rejects a non-image frame', () => {
    const result = validateInput({ input: input({ tab: 'frames', prompt: '', frames: { start: 'start', end: null } }), uploads: uploadsOf(upload('start', 'video')), preset: preset }
    )
    expect(result.errors).toContain('Start frame must be an image')
  })

  it('rejects a missing frame file with its original name', () => {
    const result = validateInput({ input: input({ tab: 'frames', prompt: '', frames: { start: 'start', end: null } }), uploads: uploadsOf(upload('start', 'image', { missing: true, originalName: 'lost.png' })), preset: preset }
    )
    expect(result.errors).toContain('File missing: lost.png')
  })

  it('allows slot tokens in frames mode as plain text', () => {
    const result = validateInput({ input: input({ tab: 'frames', prompt: '@Image 1', frames: { start: 'start', end: null } }), uploads: uploadsOf(upload('start', 'image')), preset: preset }
    )
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('rejects too many images', () => {
    const images = Array.from({ length: 11 }, (_, i) => `img${i}`)
    const uploads = uploadsOf(...images.map((id) => upload(id, 'image')))
    const result = validateInput({ input: input({ references: images }), uploads, preset: preset })
    expect(result.errors).toContain('Too many images (11, max 10)')
  })

  it('rejects video references over the total duration', () => {
    const uploads = uploadsOf(
      upload('v1', 'video', { durationSec: 10 }),
      upload('v2', 'video', { durationSec: 10 }),
    )
    const result = validateInput({ input: input({ references: ['v1', 'v2'] }), uploads, preset: preset })
    expect(result.errors).toContain('Video references are too long in total (20s, max 15s)')
  })

  it('rejects audio references over the total duration', () => {
    const uploads = uploadsOf(
      upload('a1', 'audio', { durationSec: 10 }),
      upload('a2', 'audio', { durationSec: 10 }),
    )
    const result = validateInput({ input: input({ references: ['a1', 'a2'] }), uploads, preset: preset })
    expect(result.errors).toContain('Audio references are too long in total (20s, max 15s)')
  })

  it('rejects a video reference plus output over the combined limit', () => {
    const result = validateInput({ input: input({ duration: 30, references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { durationSec: 6.8 })), preset, ctx: { remoteConfigured: true } }
    )
    expect(result.errors).toContain('Max 20s: reference videos are 6.8s in total, limit 30s')
  })

  it('rejects output over the combined limit for two 7s clips', () => {
    const result = validateInput({ input: input({ duration: 20, references: ['v1', 'v2'] }), uploads: uploadsOf(
        upload('v1', 'video', { durationSec: 7 }),
        upload('v2', 'video', { durationSec: 7 }),
      ), preset, ctx: { remoteConfigured: true } }
    )
    expect(result.errors).toContain('Max 15s: reference videos are 14s in total, limit 30s')
  })

  it('rejects audio-only references on Seedance', () => {
    const result = validateInput({ input: input({ presetId: 'seedance-2.0', references: ['a'] }), uploads: uploadsOf(upload('a', 'audio', { durationSec: 3 })), preset: getPreset('seedance-2.0') }
    )
    expect(result.errors).toContain('Audio references need at least one image or video reference')
  })

  it('rejects a video reference below the per-video minimum', () => {
    const result = validateInput({ input: input({ presetId: 'seedance-2.0', references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { durationSec: 1.5 })), preset: getPreset('seedance-2.0') }
    )
    expect(result.errors).toContain('Video 1 is 1.5s, min 2s')
  })

  it('rejects too many videos on Seedance 2.0', () => {
    const ids = ['v1', 'v2', 'v3', 'v4']
    const result = validateInput({ input: input({ presetId: 'seedance-2.0', references: ids }), uploads: uploadsOf(...ids.map((id) => upload(id, 'video', { durationSec: 2 }))), preset: getPreset('seedance-2.0') }
    )
    expect(result.errors).toContain('Too many videos (4, max 3)')
  })

  it('flags Seedance video references when remote storage is not configured', () => {
    const result = validateInput({ input: input({ presetId: 'seedance-2.0', references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { durationSec: 5 })), preset: getPreset('seedance-2.0') }
    )
    expect(result.errors).toContain(
      'Video references for Seedance 2.0 need cloud storage (R2) configured',
    )
  })

  it('accepts Seedance video references when remote storage is configured', () => {
    const result = validateInput({ input: input({ presetId: 'seedance-2.0', references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { durationSec: 5 })), preset: getPreset('seedance-2.0'), ctx: { remoteConfigured: true } }
    )
    expect(result.ok).toBe(true)
  })

  it('requires cloud storage for Wan video references', () => {
    const result = validateInput({ input: input({ references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { durationSec: 5 })), preset: preset }
    )
    expect(result.errors).toContain('Video references for Wan 3.0 need cloud storage (R2) configured')
  })

  it('requires cloud storage for Wan audio references', () => {
    const result = validateInput({ input: input({ references: ['a'] }), uploads: uploadsOf(upload('a', 'audio', { durationSec: 5 })), preset: preset }
    )
    expect(result.errors).toContain('Audio references for Wan 3.0 need cloud storage (R2) configured')
  })

  it('skips the input plus output rule when the preset disables it', () => {
    const result = validateInput({ input: input({ presetId: 'seedance-2.0', duration: 15, references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { durationSec: 10 })), preset: getPreset('seedance-2.0'), ctx: { remoteConfigured: true } }
    )
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('warns when a slot has no matching reference', () => {
    const result = validateInput({ input: input({ prompt: 'Use @Image 3 and Image 3', references: ['i1', 'i2'] }), uploads: uploadsOf(upload('i1', 'image'), upload('i2', 'image')), preset: preset }
    )
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual<ValidationIssue[]>([{ type: 'missing-slot', slot: { kind: 'image', n: 3 }, attached: 2 }])
  })

  it('does not warn when the literal label matches a reference', () => {
    const result = validateInput({ input: input({ prompt: 'Use @Image 1', references: ['i1'] }), uploads: uploadsOf(upload('i1', 'image')), preset: preset }
    )
    expect(result.warnings).toEqual([])
  })

  it('rejects a referenced upload that does not exist', () => {
    const result = validateInput({ input: input({ references: ['nope'] }), uploads: {}, preset: preset })
    expect(result.errors).toContain('Reference file not found')
  })

  it('rejects a missing referenced file', () => {
    const result = validateInput({ input: input({ references: ['ref'] }), uploads: uploadsOf(upload('ref', 'image', { missing: true, originalName: 'gone.png' })), preset: preset }
    )
    expect(result.errors).toContain('File missing: gone.png')
  })

  it('warns instead of failing for a slot past the attached references', () => {
    const result = validateInput({ input: input({ prompt: 'Look at @Image 2', references: ['ref'] }), uploads: uploadsOf(upload('ref', 'image')), preset: preset }
    )
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual<ValidationIssue[]>([{ type: 'missing-slot', slot: { kind: 'image', n: 2 }, attached: 1 }])
  })

  it('rejects a submit while four jobs are active', () => {
    const result = validateInput({ input: input(), uploads: {}, preset, ctx: { activeCount: 4 } })
    expect(result.errors).toContain('4 videos already generating. Wait for one to finish.')
  })

  it('rejects an oversized video reference sent inline', () => {
    const inline = { ...preset, inputTransport: { image: 'base64', video: 'base64', audio: 'base64' } } as const
    const result = validateInput({ input: input({ references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { sizeBytes: 60 * mb })), preset: inline }
    )
    expect(result.errors).toContain('Reference too large to send inline (60 MB, max 50 MB)')
  })

  it('allows a large video reference sent by link', () => {
    const result = validateInput({ input: input({ presetId: 'seedance-2.0', references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { sizeBytes: 60 * mb, durationSec: 5 })), preset: getPreset('seedance-2.0'), ctx: { remoteConfigured: true } }
    )
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('warns about a low resolution image', () => {
    const result = validateInput({ input: input({ references: ['img'] }), uploads: uploadsOf(upload('img', 'image', { width: 250, height: 400 })), preset: preset }
    )
    expect(result.ok).toBe(true)
    expect(result.warnings).toContainEqual({ type: 'text', text: 'Low resolution input, output may look soft' })
  })

  it('rejects a Wan image below the minimum side', () => {
    const result = validateInput({ input: input({ references: ['img'] }), uploads: uploadsOf(upload('img', 'image', { width: 200, height: 400, originalName: 'logo.png' })), preset: preset }
    )
    expect(result.errors).toContain('Image too small: 200 px, min 240 px (logo.png)')
  })

  it('rejects a Wan video beyond the maximum side', () => {
    const result = validateInput({ input: input({ references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { width: 4800, height: 2160, originalName: 'drone.mov' })), preset, ctx: { remoteConfigured: true } }
    )
    expect(result.errors).toContain('Video too large: 4800 px, max 4096 px (drone.mov)')
  })

  it('rejects a Wan image beyond the maximum aspect', () => {
    const result = validateInput({ input: input({ references: ['img'] }), uploads: uploadsOf(upload('img', 'image', { width: 900, height: 100, originalName: 'banner.png' })), preset: preset }
    )
    expect(result.errors).toContain('Image too narrow: 9:1, max 8:1 (banner.png)')
  })

  it('rejects a Wan video over the file size with rounded MB', () => {
    const result = validateInput({ input: input({ references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { sizeBytes: 140 * mb, originalName: 'drone.mov' })), preset, ctx: { remoteConfigured: true } }
    )
    expect(result.errors).toContain('Video file too large: 140 MB, max 100 MB (drone.mov)')
  })

  it('rejects a Wan video with the wrong extension', () => {
    const result = validateInput({ input: input({ references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { ext: '.webm', originalName: 'clip.webm' })), preset, ctx: { remoteConfigured: true } }
    )
    expect(result.errors).toContain('Wan 3.0 takes video references as mp4 or mov (clip.webm)')
  })

  it('rejects a Wan audio reference with the wrong extension', () => {
    const result = validateInput({ input: input({ references: ['a'] }), uploads: uploadsOf(upload('a', 'audio', { ext: '.m4a', originalName: 'track.m4a' })), preset, ctx: { remoteConfigured: true } }
    )
    expect(result.errors).toContain('Wan 3.0 takes audio references as wav or mp3 (track.m4a)')
  })

  it('applies image limits to frame uploads', () => {
    const result = validateInput({ input: input({ tab: 'frames', prompt: 'A cat', frames: { start: 'start', end: null } }), uploads: uploadsOf(upload('start', 'image', { width: 200, height: 400, originalName: 'small.png' })), preset: preset }
    )
    expect(result.errors).toContain('Image too small: 200 px, min 240 px (small.png)')
  })
})

describe('maxDurationFor', () => {
  it('returns the preset max on the frames tab', () => {
    expect(
      maxDurationFor({ input: input({ tab: 'frames', references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { durationSec: 20 })), preset: preset }
      ),
    ).toBe(preset.duration.max)
  })

  it('returns the preset max without a video reference', () => {
    expect(maxDurationFor({ input: input({ references: ['i'] }), uploads: uploadsOf(upload('i', 'image')), preset: preset })).toBe(
      preset.duration.max,
    )
  })

  it('subtracts the total video duration and floors, clamped to the preset range', () => {
    expect(
      maxDurationFor({ input: input({ references: ['v1'] }), uploads: uploadsOf(upload('v1', 'video', { durationSec: 6.8 })), preset: preset }
      ),
    ).toBe(20)
    const uploads = uploadsOf(
      upload('v1', 'video', { durationSec: 6.8 }),
      upload('v2', 'video', { durationSec: 3 }),
    )
    expect(maxDurationFor({ input: input({ references: ['v1', 'v2'] }), uploads, preset: preset })).toBe(20)
    expect(
      maxDurationFor({ input: input({ references: ['v1'] }), uploads: uploadsOf(upload('v1', 'video', { durationSec: 60 })), preset: preset }),
    ).toBe(minDuration(preset))
  })

  it('caps two 7s reference videos at 15s', () => {
    const uploads = uploadsOf(
      upload('v1', 'video', { durationSec: 7 }),
      upload('v2', 'video', { durationSec: 7 }),
    )
    expect(maxDurationFor({ input: input({ references: ['v1', 'v2'] }), uploads, preset: preset })).toBe(15)
  })

  it('returns the preset max when the combined rule is off', () => {
    const seedance = getPreset('seedance-2.0')
    expect(
      maxDurationFor({ input: input({ presetId: 'seedance-2.0', references: ['v'] }), uploads: uploadsOf(upload('v', 'video', { durationSec: 10 })), preset: seedance }
      ),
    ).toBe(seedance.duration.max)
  })

  it('rounds the numeric limit down to a preset option', () => {
    const optionPreset = {
      ...preset,
      duration: { min: 4, max: 8, default: 6, options: [4, 6, 8] as const },
    }
    const uploads = uploadsOf(upload('v', 'video', { durationSec: 25 }))
    expect(maxDurationFor({ input: input({ references: ['v'] }), uploads, preset: optionPreset })).toBe(4)
    expect(maxDurationFor({ input: input({ tab: 'frames' }), uploads: {}, preset: optionPreset })).toBe(8)
  })
})


describe('issueText', () => {
  it('formats each missing-slot kind exactly', () => {
    expect(issueText({ type: 'missing-slot', slot: { kind: 'image', n: 3 }, attached: 2 })).toBe(
      '@Image 3 is not attached (2 images)',
    )
    expect(issueText({ type: 'missing-slot', slot: { kind: 'video', n: 1 }, attached: 0 })).toBe(
      '@Video 1 is not attached (0 videos)',
    )
    expect(issueText({ type: 'missing-slot', slot: { kind: 'audio', n: 2 }, attached: 1 })).toBe(
      '@Audio 2 is not attached (1 audio)',
    )
  })

  it('passes text warnings through unchanged', () => {
    expect(issueText({ type: 'text', text: 'Low resolution input, output may look soft' })).toBe(
      'Low resolution input, output may look soft',
    )
  })
})
