import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { isNil, isString } from 'lodash-es'

import { FETCH_TIMEOUTS, MOCK_GENERATE_MS, MOCK_QUEUE_MS } from '@/core/constants'
import type { PixelSize } from '@/core/geometry'
import { isRecord } from '@/core/guards'
import { outputSize } from '@/core/output-size'
import { MODEL_PRESETS } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'
import { primaryBinding } from '@/core/pricing'
import { asJobStatus } from '@/core/submit-state'
import type { PricingInfo, TestResult } from '@/core/types'

import { globalState } from '../../global-state'
import { MOCK_REMOTE_PREFIX } from '../../local-url'
import { makeTestVideo } from '../../media/ffmpeg'
import { buildRequestBody } from '../openrouter/body'
import type { VideoJobResponse } from '../openrouter/http'
import { ProviderError } from '../provider-error'
import type {
  ContentFallback,
  ContentRequest,
  JobRef,
  JobSnapshot,
  JobUsage,
  ProviderAccount,
  SubmitJobParams,
  SubmittedJob,
  VideoProvider,
} from '../types'
import { listModels } from './models'

interface MockState {
  mockStart: Map<string, number>
  mockPrompt: Map<string, string>
  mockBody: Map<string, unknown>
}

const mockState = globalState<MockState>('mock', () => ({
  mockStart: new Map(),
  mockPrompt: new Map(),
  mockBody: new Map(),
}))

/** Mock OpenRouter adapter. Runs the whole pipeline without provider calls. */
export function createMockProvider(): VideoProvider {
  return {
    id: 'openrouter',
    isConfigured,
    submit,
    getJob,
    fetchContent,
    getAccount,
    getPricing,
    listModels,
    testConnection,
  }
}

function isConfigured(): boolean {
  return true
}

async function submit(params: SubmitJobParams): Promise<SubmittedJob> {
  const { preset, input, media } = params
  const body = buildRequestBody({ input, preset, media })
  const job = await mockSubmit(body)

  return { jobId: job.id, status: asJobStatus(job.status) ?? 'pending' }
}

async function getJob(params: JobRef): Promise<JobSnapshot> {
  const job = mockJob(params.jobId, params.submittedAt)

  return {
    status: asJobStatus(job.status) ?? 'pending',
    generationId: null,
    expiresAt: null,
    urls: null,
    usage: toUsage(job.usage),
    error: job.error ?? null,
  }
}

function toUsage(usage: VideoJobResponse['usage']): JobUsage | null {
  if (isNil(usage)) {
    return null
  }

  return {
    costUsd: usage.cost ?? null,
    isByok: usage.is_byok ?? null,
    usesEstimatedCost: true,
  }
}

async function fetchContent(params: ContentRequest): Promise<Response> {
  const { job, fallback } = params

  return mockContent(job.jobId, fallback ?? undefined)
}

async function getAccount(): Promise<ProviderAccount> {
  return {
    balance: 0,
    keyLimitRemaining: 0,
    keyLimit: 0,
    usageDaily: 0,
    usageMonthly: 0,
    source: 'mock',
    fetchedAt: new Date().toISOString(),
    error: null,
  }
}

async function getPricing(preset: ModelPreset): Promise<PricingInfo> {
  const listSkus = { ...primaryBinding(preset).pricing.fallback }

  return {
    skus: { ...listSkus },
    listSkus,
    discount: 0,
    source: 'mock',
    fetchedAt: new Date().toISOString(),
  }
}

async function testConnection(): Promise<TestResult> {
  return { ok: true, mock: true }
}

interface MockSubmitResult {
  id: string
  status: string
}

async function mockSubmit(body: unknown): Promise<MockSubmitResult> {
  const links: string[] = []

  collectMockLinks(body, links)

  for (const link of links) {
    await assertMockFetch(link)
  }

  const shouldFail = JSON.stringify(body).includes('[fail]')
  const id = `${shouldFail ? 'mockfail' : 'mock'}-${randomUUID()}`
  const prompt = field(body, 'prompt')

  mockState.mockStart.set(id, Date.now())
  mockState.mockPrompt.set(id, isString(prompt) ? prompt : '')
  mockState.mockBody.set(id, body)

  return { id, status: 'pending' }
}

/** Fails the mock job when a generated link is not fetchable, as a provider would. */
async function assertMockFetch(link: string): Promise<void> {
  const status = await fetch(link, {
    method: 'HEAD',
    signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
  })
    .then((res) => res.status)
    .catch(() => 0)

  if (status !== 200) {
    const message = `Mock provider could not fetch ${link}`

    throw new ProviderError({
      providerId: 'openrouter',
      kind: 'url_input',
      message,
      storedMessage: message,
      status: 400,
      code: null,
    })
  }
}

function collectMockLinks(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const child of value) {
      collectMockLinks(child, out)
    }

    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'url' && isString(child)) {
      if (child.startsWith(MOCK_REMOTE_PREFIX)) {
        out.push(child)
      }

      continue
    }

    collectMockLinks(child, out)
  }
}

function mockJob(id: string, submittedAt?: string): VideoJobResponse {
  const elapsed = Date.now() - mockStarted(id, submittedAt)

  if (elapsed < MOCK_QUEUE_MS) {
    return { id, status: 'pending' }
  }

  if (elapsed < MOCK_QUEUE_MS + MOCK_GENERATE_MS) {
    return { id, status: 'in_progress' }
  }

  if (id.startsWith('mockfail-')) {
    return { id, status: 'failed', error: 'Mock failure' }
  }

  return { id, status: 'completed', usage: { cost: 0, is_byok: false } }
}

function mockStarted(id: string, submittedAt?: string): number {
  const stored = mockState.mockStart.get(id)

  if (!isNil(stored)) {
    return stored
  }

  const parsed = isNil(submittedAt) || submittedAt === '' ? Number.NaN : Date.parse(submittedAt)

  return Number.isFinite(parsed) ? parsed : Date.now()
}

async function mockContent(id: string, fallback?: ContentFallback): Promise<Response> {
  const body = mockState.mockBody.get(id)
  const resolution = field(body, 'resolution') ?? fallback?.resolution
  const aspect = field(body, 'aspect_ratio') ?? fallback?.aspectRatio
  const rawDuration = field(body, 'duration') ?? fallback?.duration
  const duration = typeof rawDuration === 'number' ? rawDuration : 5

  const { width, height } = mockDimensions({
    model: field(body, 'model'),
    presetId: fallback?.presetId,
    resolution,
    aspect,
  })

  const file = path.join(os.tmpdir(), `wan-mock-${randomUUID()}.mp4`)

  try {
    await makeTestVideo(file, { width, height, durationSec: duration })
    const bytes = await fs.readFile(file)

    return new Response(Uint8Array.from(bytes), { headers: { 'content-type': 'video/mp4' } })
  } finally {
    await fs.unlink(file).catch(() => {})
  }
}

interface MockDimensionsParams {
  model: unknown
  presetId: unknown
  resolution: unknown
  aspect: unknown
}

/** Sizes the mock from the model slug or preset id, falling back to 720p 16:9. */
function mockDimensions(params: MockDimensionsParams): PixelSize {
  const { model, presetId, resolution, aspect } = params

  const preset =
    MODEL_PRESETS.find((item) => primaryBinding(item).modelId === model) ??
    MODEL_PRESETS.find((item) => item.id === presetId)

  const res = preset?.resolutions.find((item) => item === resolution)

  if (isNil(preset) || isNil(res)) {
    return { width: 1280, height: 720 }
  }

  const ratio = aspect === 'auto' ? undefined : preset.aspectRatios.find((item) => item === aspect)

  return (
    outputSize({ preset, resolution: res, aspect: ratio ?? preset.defaultAspectRatio }) ?? {
      width: 1280,
      height: 720,
    }
  )
}

function field(body: unknown, key: string): unknown {
  if (!isRecord(body)) {
    return undefined
  }

  return body[key]
}
