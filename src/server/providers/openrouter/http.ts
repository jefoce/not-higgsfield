import 'server-only'

import { isNil, isString } from 'lodash-es'
import { z } from 'zod'

import { PROVIDER_RAW_MAX_CHARS } from '@/core/constants'
import { isNonEmptyString, isRecord } from '@/core/guards'

import { getSecret } from '../../secrets'
import { OpenRouterError } from './error'

export const BASE_URL = 'https://openrouter.ai'

export const SubmitSchema = z
  .object({
    id: z.string(),
    polling_url: z.string().optional(),
    status: z.string(),
  })
  .loose()

const UsageSchema = z
  .object({
    cost: z.number().nullable().optional(),
    is_byok: z.boolean().optional(),
  })
  .loose()

export const JobSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    generation_id: z.string().optional(),
    unsigned_urls: z.array(z.string()).optional(),
    urls: z.array(z.string()).optional(),
    expires_at: z.number().optional(),
    usage: UsageSchema.optional(),
    error: z.string().optional(),
  })
  .loose()

export type VideoJobResponse = z.infer<typeof JobSchema>

export type VideoJobUsage = z.infer<typeof UsageSchema>

interface RequestParams {
  url: string
  init: RequestInit
  timeoutMs: number
}

/** Runs an outbound call. Aborts become retryable status 0 errors. */
export async function request(params: RequestParams): Promise<Response> {
  const { url, init, timeoutMs } = params

  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    if (error instanceof OpenRouterError) {
      throw error
    }

    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new OpenRouterError({ message: 'Request timed out', status: 0 })
    }

    throw error
  }
}

export function headers(isJson: boolean): Record<string, string> {
  const key = getSecret('OPENROUTER_API_KEY')

  if (!isNonEmptyString(key)) {
    throw new OpenRouterError({
      message: 'OpenRouter key is not set. Open Settings.',
      status: 401,
      code: 'no_key',
    })
  }

  const result: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Not Higgsfield',
  }

  if (isJson) {
    result['Content-Type'] = 'application/json'
  }

  return result
}

/** Provider detail from `error.metadata`, never headers or the request body. */
export async function errorFromResponse(res: Response): Promise<OpenRouterError> {
  const payload: unknown = await res.json().catch(() => null)
  const isError = isRecord(payload)

  const error = isError ? payload.error : undefined
  const normalized = normalizeBase(readErrorMessage(error) ?? res.statusText, res.status)
  const detail = providerDetail(error)
  const base = normalized.message === '' ? `HTTP ${res.status}` : normalized.message
  const message = detail === '' ? base : `${base} (${detail})`

  return new OpenRouterError({
    message,
    status: res.status,
    code: normalized.code ?? codeValue(errorCode(error)),
  })
}

function readErrorMessage(error: unknown): string | null {
  if (isRecord(error) && isString(error.message)) {
    return error.message
  }

  return null
}

function errorCode(error: unknown): unknown {
  if (isRecord(error)) {
    return error.code
  }

  return undefined
}

function providerDetail(error: unknown): string {
  let meta: Record<string, unknown> | null = null

  if (isRecord(error) && isRecord(error.metadata)) {
    meta = error.metadata
  }

  if (isNil(meta)) {
    return ''
  }

  let rawText: string | null = null

  if (isString(meta.raw)) {
    rawText = meta.raw
  }

  const raw = rawText?.slice(0, PROVIDER_RAW_MAX_CHARS) ?? null
  let provider: string | null = null

  if (isString(meta.provider_name)) {
    provider = meta.provider_name
  }

  return [provider, raw].filter(Boolean).join(': ')
}

/** Removes repeated `HTTP <status>:` and `<status>:` prefixes. */
function stripStatusPrefix(message: string, status: number): string {
  return message.replace(new RegExp(`^(?:(?:HTTP\\s+)?${status}:\\s*)+`, 'i'), '').trim()
}

interface NormalizedError {
  message: string
  code?: string
}

/** Unwraps a JSON error body nested in the provider message, at most twice. */
function normalizeBase(input: string, status: number): NormalizedError {
  let message = input
  let code: string | undefined

  for (let pass = 0; pass < 2; pass += 1) {
    message = stripStatusPrefix(message, status)
    const error = innerError(message)

    if (!error) {
      break
    }

    code = codeValue(error.code) ?? code

    if (isString(error.message)) {
      message = error.message
    } else {
      message = ''
    }
  }

  return { message, code }
}

function innerError(message: string): Record<string, unknown> | null {
  if (!message.startsWith('{')) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(message)

    if (!isRecord(parsed)) {
      return null
    }

    if (isRecord(parsed.error)) {
      return parsed.error
    }

    return parsed
  } catch {
    return null
  }
}

function codeValue(value: unknown): string | undefined {
  if (isString(value) || typeof value === 'number') {
    return String(value)
  }

  return undefined
}
