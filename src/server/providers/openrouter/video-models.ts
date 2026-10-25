import 'server-only'

import { z } from 'zod'

import { FETCH_TIMEOUTS, PRICING_FALLBACK_TTL_MS } from '@/core/constants'

import { onSecretsChange } from '../../secrets'
import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'
import { BASE_URL } from './http'

const MODELS_URL = `${BASE_URL}/api/v1/videos/models`
const LIVE_TTL_MS = 3_600_000

const VideoModelSchema = z
  .object({
    id: z.string(),
    pricing_skus: z.record(z.string(), z.unknown()).optional(),
    supported_durations: z.array(z.number()).optional(),
    supported_resolutions: z.array(z.string()).optional(),
    supported_aspect_ratios: z.array(z.string()).optional(),
    supported_frame_images: z.array(z.string()).optional(),
    generate_audio: z.boolean().optional(),
    seed: z.boolean().optional(),
  })
  .loose()

export type VideoModel = z.infer<typeof VideoModelSchema>

const VideoModelsSchema = z.object({ data: z.array(VideoModelSchema) }).loose()

const cache = createTtlCache<readonly VideoModel[]>({
  key: 'videoModels',
  okTtlMs: LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

/** Shared `/videos/models` list. A failure caches an empty list for five minutes. */
export async function fetchVideoModels(isForce = false): Promise<readonly VideoModel[]> {
  return cache.get('models', loadVideoModels, isForce)
}

async function loadVideoModels(): Promise<TtlLoadResult<readonly VideoModel[]>> {
  try {
    return { value: await fetchModels(), isOk: true }
  } catch {
    return { value: [], isOk: false }
  }
}

async function fetchModels(): Promise<readonly VideoModel[]> {
  const res = await fetch(MODELS_URL, {
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status} ${res.statusText}`)
  }

  const parsed = VideoModelsSchema.safeParse(await res.json())

  if (!parsed.success) {
    throw new Error('Invalid OpenRouter models response')
  }

  return parsed.data.data
}

onSecretsChange(() => {
  cache.clear()
})
