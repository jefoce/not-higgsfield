import { describe, expect, it } from 'vitest'
import { friendlyError } from '@/core/provider-errors'

const REAL_PERSON =
  "InputImageSensitiveContentDetected.PrivacyInformation: The request failed because the input image 'content[1]' may contain real person. Request id: 0217925672818..."

describe('friendlyError', () => {
  it('translates the two real Seedance 2.0 and 2.5 strings', () => {
    for (const prefix of ['', 'Seedance 2.5: ']) {
      const raw = `${prefix}${REAL_PERSON}`
      expect(friendlyError({ raw, family: 'seedance' })).toEqual({
        title: 'Seedance blocks images that look like real people, even AI-made ones.',
        hint: 'Use Wan 3.0 for this reference, or a stylized character.',
        kind: 'real_person',
        retry: false,
        raw,
      })
    }
  })

  it('matches specific codes before their parent code', () => {
    expect(friendlyError({ raw: REAL_PERSON, family: 'seedance' }).kind).toBe('real_person')
    expect(
      friendlyError({ raw: 'InputImageSensitiveContentDetected: The request failed.', family: 'seedance' }).kind,
    ).toBe('content')
  })

  it('keeps Seedance and Wan families isolated', () => {
    expect(friendlyError({ raw: REAL_PERSON, family: 'wan' }).kind).toBe('unknown')
    expect(
      friendlyError({ raw: 'DataInspectionFailed: Output data may contain inappropriate content.', family: 'seedance' })
        .kind,
    ).toBe('unknown')
    expect(friendlyError({ raw: 'DataInspectionFailed: bad input', family: 'wan' }).kind).toBe('content')
  })

  it('returns the unknown fallback with the raw hint', () => {
    const raw = 'Something odd happened at the provider'
    expect(friendlyError({ raw, family: 'seedance' })).toEqual({
      title: 'Generation failed',
      hint: raw,
      kind: 'unknown',
      retry: false,
      raw,
    })
  })

  it('maps Seedance control codes', () => {
    const rows: Array<{ raw: string; title: string; kind: string; retry?: boolean }> = [
      { raw: 'InputVideoSensitiveContentDetected.PrivacyInformation: blocked', title: 'Seedance blocks videos that show real people.', kind: 'real_person' },
      { raw: 'InputImageSensitiveContentDetected.PolicyViolation: blocked', title: 'Your image may be copyrighted.', kind: 'copyright' },
      { raw: 'InputTextSensitiveContentDetected.PolicyViolation: blocked', title: 'Your prompt may be copyrighted.', kind: 'copyright' },
      { raw: 'OutputVideoSensitiveContentDetected.PolicyViolation: blocked', title: 'The result looked like copyrighted material and was blocked.', kind: 'copyright' },
      { raw: 'InputTextSensitiveContentDetected: blocked', title: "Seedance's content check flagged your prompt.", kind: 'content' },
      { raw: 'InputAudioSensitiveContentDetected: blocked', title: "Seedance's content check flagged a reference audio.", kind: 'content' },
      { raw: 'OutputVideoSensitiveContentDetected: blocked', title: "The finished video was blocked by Seedance's content check.", kind: 'content' },
      { raw: 'SensitiveContentDetected: blocked', title: "Seedance's content check flagged this request.", kind: 'content' },
      { raw: 'InvalidImageURL.InvalidFormat: bad image', title: 'Seedance could not read one of the images.', kind: 'input' },
      { raw: 'InvalidParameter.TaskTypeConstraint: mixed', title: 'Seedance does not accept this mix of frames and references.', kind: 'input' },
      { raw: 'InvalidParameter: duration is invalid', title: 'Seedance rejected a setting: duration.', kind: 'input' },
      { raw: 'MissingParameter.Frames', title: 'Seedance rejected a setting: Frames.', kind: 'input' },
      { raw: 'RateLimitExceeded: slow down', title: 'Seedance is busy right now.', kind: 'busy', retry: true },
      { raw: 'InternalServiceError: try later', title: 'Seedance had an internal error.', kind: 'provider', retry: true },
    ]
    for (const row of rows) {
      const friendly = friendlyError({ raw: row.raw, family: 'seedance' })
      expect(friendly.title, row.raw).toBe(row.title)
      expect(friendly.kind, row.raw).toBe(row.kind)
      expect(friendly.retry, row.raw).toBe(row.retry ?? false)
      expect(friendly.raw, row.raw).toBe(row.raw)
    }
  })

  it('maps Wan codes and phrases', () => {
    const rows: Array<{ raw: string; title: string; kind: string; retry?: boolean }> = [
      { raw: 'DataInspectionFailed: Output data may contain inappropriate content.', title: "The finished video was blocked by Wan's content check.", kind: 'content' },
      { raw: 'DataInspectionFailed: Input data may contain inappropriate content.', title: "Wan's content check flagged your prompt or a reference.", kind: 'content' },
      { raw: 'green network verification failed', title: "Wan's content check flagged a reference image.", kind: 'content' },
      { raw: 'IPInfringementSuspect: brand', title: 'Your prompt or references may be copyrighted.', kind: 'copyright' },
      { raw: 'CustomRoleBlocked: blocked', title: 'The request was blocked by a provider rule.', kind: 'content' },
      { raw: 'InvalidFile.Size: too large', title: 'A reference file is too large for Wan.', kind: 'input' },
      { raw: 'InvalidFile.Format: bad format', title: 'Wan does not accept one of the file formats.', kind: 'input' },
      { raw: 'InvalidFile.Duration: bad length', title: 'A reference clip is too short or too long.', kind: 'input' },
      { raw: 'InvalidImageResolution: bad size', title: "A reference does not fit Wan's size, shape or frame rate limits.", kind: 'input' },
      { raw: 'InvalidFile.Openerror: broken', title: 'Wan could not open one of the references.', kind: 'input' },
      { raw: 'InvalidParameter.DataInspection: check failed', title: 'Wan could not download a reference from your storage.', kind: 'input' },
      { raw: 'InvalidParameter: resolution 9000p', title: 'Wan rejected a setting: resolution.', kind: 'input' },
      { raw: 'Throttling.User: too fast', title: 'Wan is busy right now.', kind: 'busy', retry: true },
      { raw: 'Arrearage: pay up', title: "The provider refused the request on OpenRouter's side.", kind: 'account' },
      { raw: 'InternalError.Algo: retry', title: 'Wan had an internal error.', kind: 'provider', retry: true },
    ]
    for (const row of rows) {
      const friendly = friendlyError({ raw: row.raw, family: 'wan' })
      expect(friendly.title, row.raw).toBe(row.title)
      expect(friendly.kind, row.raw).toBe(row.kind)
      expect(friendly.retry, row.raw).toBe(row.retry ?? false)
    }
  })

  it('falls back to OpenRouter HTTP codes when no family code matches', () => {
    const rows: Array<[number, string, string]> = [
      [400, 'OpenRouter rejected the request.', 'input'],
      [401, 'Your OpenRouter key is not valid.', 'account'],
      [402, 'Not enough OpenRouter credits.', 'account'],
      [403, 'Flagged by moderation.', 'content'],
      [408, 'OpenRouter timed out.', 'provider'],
      [429, 'Too many requests to OpenRouter.', 'busy'],
      [502, 'The model is down right now.', 'provider'],
      [503, 'No provider can run this request right now.', 'provider'],
    ]
    for (const [code, title, kind] of rows) {
      const friendly = friendlyError({ raw: 'upstream said no', family: null, httpCode: code })
      expect(friendly.title, String(code)).toBe(title)
      expect(friendly.kind, String(code)).toBe(kind)
    }
    expect(friendlyError({ raw: REAL_PERSON, family: 'seedance', httpCode: 400 }).kind).toBe('real_person')
  })

  it('maps app errors', () => {
    expect(friendlyError({ raw: 'Interrupted while sending. Check OpenRouter activity', family: 'wan' }).kind).toBe('app')
    expect(friendlyError({ raw: 'OpenRouter copy expired before download', family: 'wan' }).title).toBe(
      'The finished video was not saved.',
    )
    expect(friendlyError({ raw: 'Disk is full. Free some space', family: 'wan' }).kind).toBe('app')
    expect(friendlyError({ raw: 'OpenRouter key is not set. Open Settings.', family: 'wan' }).kind).toBe('account')
  })
})
