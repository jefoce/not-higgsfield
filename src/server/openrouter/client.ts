import 'server-only'
import { z } from 'zod'
import { FETCH_TIMEOUTS, PROVIDER_RAW_MAX_CHARS } from '@/core/constants'
import { getSecret } from '../secrets'
import { OpenRouterError } from './error'
import { mockContent, mockJob, mockSubmit, type MockContentFallback } from './mock-provider'

export { OpenRouterError } from './error'

const BASE_URL = 'https://openrouter.ai'

const SubmitSchema = z
  .object({
    id: z.string(),
    polling_url: z.string().optional(),
    status: z.string(),
  })
  .passthrough()

const JobSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    generation_id: z.string().optional(),
    unsigned_urls: z.array(z.string()).optional(),
    urls: z.array(z.string()).optional(),
    expires_at: z.number().optional(),
    usage: z
      .object({
        cost: z.number().nullable().optional(),
        is_byok: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    error: z.string().optional(),
  })
  .passthrough()

export type VideoJobResponse = z.infer<typeof JobSchema>

export function isMockMode(): boolean {
  return process.env.OPENROUTER_MOCK === '1'
}

/** Submits a video generation request. */
export async function submitVideo(
  body: unknown,
): Promise<{ id: string; polling_url?: string; status: string }> {
  if (isMockMode()) return mockSubmit(body)

  const res = await request(`${BASE_URL}/api/v1/videos`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(body),
  }, FETCH_TIMEOUTS.submit)
  if (!res.ok) throw await errorFromResponse(res)

  const parsed = SubmitSchema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new OpenRouterError('Invalid submit response', res.status)
  return parsed.data
}

/** Reads one job. `submittedAt` is the mock clock fallback after a restart. */
export async function getVideoJob(
  id: string,
  opts?: { submittedAt?: string },
): Promise<VideoJobResponse> {
  if (isMockMode()) return mockJob(id, opts?.submittedAt)

  const res = await request(`${BASE_URL}/api/v1/videos/${encodeURIComponent(id)}`, {
    headers: headers(false),
    cache: 'no-store',
  }, FETCH_TIMEOUTS.poll)
  if (!res.ok) throw await errorFromResponse(res)

  const parsed = JobSchema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new OpenRouterError('Invalid job response', res.status)
  return parsed.data
}

/** Returns the raw content response. The caller streams and closes it. */
interface FetchVideoContentParams {
  id: string
  index?: number
  fallback?: MockContentFallback
}

export async function fetchVideoContent(params: FetchVideoContentParams): Promise<Response> {
  const { id, index = 0, fallback } = params
  if (isMockMode()) return mockContent(id, fallback)

  const res = await request(
    `${BASE_URL}/api/v1/videos/${encodeURIComponent(id)}/content?index=${index}`,
    { headers: headers(false), cache: 'no-store' },
    FETCH_TIMEOUTS.content,
  )
  if (!res.ok) throw await errorFromResponse(res)
  return res
}

/** Runs an outbound call. Aborts become retryable status 0 errors. */
async function request(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    if (error instanceof OpenRouterError) throw error
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new OpenRouterError('Request timed out', 0)
    }
    throw error
  }
}

function headers(json: boolean): Record<string, string> {
  const key = getSecret('OPENROUTER_API_KEY')
  if (!key) throw new OpenRouterError('OpenRouter key is not set. Open Settings.', 401, 'no_key')
  return {
    Authorization: `Bearer ${key}`,
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Not Higgsfield',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

/** Provider detail from `error.metadata`, never headers or the request body. */
export async function errorFromResponse(res: Response): Promise<OpenRouterError> {
  const payload: unknown = await res.json().catch(() => null)
  const error = isRecord(payload) ? payload.error : undefined
  const topCode = codeValue(isRecord(error) ? error.code : undefined)
  const rawBase =
    isRecord(error) && typeof error.message === 'string' ? error.message : res.statusText
  const normalized = normalizeBase(rawBase, res.status)
  const meta = isRecord(error) && isRecord(error.metadata) ? error.metadata : null
  const raw =
    meta && typeof meta.raw === 'string' ? meta.raw.slice(0, PROVIDER_RAW_MAX_CHARS) : null
  const provider = meta && typeof meta.provider_name === 'string' ? meta.provider_name : null
  const detail = [provider, raw].filter(Boolean).join(': ')
  const base = normalized.message || `HTTP ${res.status}`
  return new OpenRouterError(
    detail ? `${base} (${detail})` : base,
    res.status,
    normalized.code ?? topCode,
  )
}

/** Removes repeated `HTTP <status>:` and `<status>:` prefixes. */
export function stripStatusPrefix(message: string, status: number): string {
  return message.replace(new RegExp(`^(?:(?:HTTP\\s+)?${status}:\\s*)+`, 'i'), '').trim()
}

/** Unwraps a JSON error body nested in the provider message, at most twice. */
function normalizeBase(input: string, status: number): { message: string; code?: string } {
  let message = input
  let code: string | undefined
  for (let pass = 0; pass < 2; pass += 1) {
    message = stripStatusPrefix(message, status)
    const error = innerError(message)
    if (!error) break
    code = codeValue(error.code) ?? code
    message = typeof error.message === 'string' ? error.message : ''
  }
  return { message, code }
}

function innerError(message: string): Record<string, unknown> | null {
  if (!message.startsWith('{')) return null
  try {
    const parsed: unknown = JSON.parse(message)
    if (!isRecord(parsed)) return null
    return isRecord(parsed.error) ? parsed.error : parsed
  } catch {
    return null
  }
}

function codeValue(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}


