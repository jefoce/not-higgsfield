import { describe, expect, it } from 'vitest'

import { OpenRouterError } from '@/server/openrouter/error'
import { classifyOpenRouterError } from '@/server/providers/openrouter/errors'
import { ProviderError, type ProviderErrorKind } from '@/server/providers/provider-error'

interface MappingCase {
  kind: ProviderErrorKind
  message: string
  status: number
  code?: string
}

const MAPPING_CASES: readonly MappingCase[] = [
  {
    kind: 'no_key',
    message: 'OpenRouter key is not set. Open Settings.',
    status: 401,
    code: 'no_key',
  },
  { kind: 'auth', message: 'Invalid API key', status: 401 },
  { kind: 'credits', message: 'Insufficient credits', status: 402 },
  { kind: 'not_found', message: 'Video not found', status: 404 },
  { kind: 'rate_limit', message: 'Too many requests', status: 429 },
  { kind: 'timeout', message: 'Request timed out', status: 408 },
  { kind: 'server', message: 'Bad gateway', status: 502 },
  { kind: 'url_input', message: 'Could not download image_url', status: 400 },
  { kind: 'input', message: 'Bad prompt', status: 422 },
  { kind: 'content', message: 'Image was flagged by moderation', status: 403 },
  { kind: 'unknown', message: 'Teapot', status: 418 },
]

describe('classifyOpenRouterError', () => {
  it.each(MAPPING_CASES)('classifies $kind', (testCase) => {
    const { kind, message, status, code } = testCase

    const error = classifyOpenRouterError(new OpenRouterError({ message, status, code }))

    expect(error).toBeInstanceOf(ProviderError)
    expect(error.providerId).toBe('openrouter')
    expect(error.kind).toBe(kind)
    expect(error.message).toBe(message)
    expect(error.status).toBe(status)
    expect(error.code).toBe(code ?? null)
  })

  it('classifies a non-provider error as unknown with status 0', () => {
    const error = classifyOpenRouterError(new Error('boom'))

    expect(error.kind).toBe('unknown')
    expect(error.status).toBe(0)
    expect(error.message).toBe('boom')
    expect(error.code).toBeNull()
  })
})
