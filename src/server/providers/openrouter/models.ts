import 'server-only'

import { z } from 'zod'

import { FETCH_TIMEOUTS, PRICING_FALLBACK_TTL_MS } from '@/core/constants'

import { onSecretsChange } from '../../secrets'
import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'
import type { ProviderModel, ProviderModelList } from '../types'
import { BASE_URL } from './http'

const MODELS_URL = `${BASE_URL}/api/v1/videos/models`
const LIVE_TTL_MS = 3_600_000

const ModelSchema = z
  .object({
    id: z.string(),
    supported_durations: z.array(z.number()).optional(),
    supported_resolutions: z.array(z.string()).optional(),
    supported_aspect_ratios: z.array(z.string()).optional(),
    supported_frame_images: z.array(z.string()).optional(),
    generate_audio: z.boolean().optional(),
    seed: z.boolean().optional(),
  })
  .loose()

const ModelsSchema = z.object({ data: z.array(ModelSchema) }).loose()

const cache = createTtlCache<ProviderModelList>({
  key: 'providerModels',
  okTtlMs: LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

let lastModels: readonly ProviderModel[] = []

/** Live model capabilities. A good result caches for an hour, a failure for five minutes. */
export async function listModels(): Promise<ProviderModelList> {
  return cache.get('models', loadModels)
}

async function loadModels(): Promise<TtlLoadResult<ProviderModelList>> {
  try {
    const models = await fetchModels()

    lastModels = models

    return { value: { models, isFresh: true }, isOk: true }
  } catch {
    return { value: { models: lastModels, isFresh: false }, isOk: false }
  }
}

async function fetchModels(): Promise<readonly ProviderModel[]> {
  const res = await fetch(MODELS_URL, {
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status} ${res.statusText}`)
  }

  const parsed = ModelsSchema.safeParse(await res.json())

  if (!parsed.success) {
    throw new Error('Invalid OpenRouter models response')
  }

  return parsed.data.data.map(toModel)
}

function toModel(model: z.infer<typeof ModelSchema>): ProviderModel {
  return {
    modelId: model.id,
    durations: model.supported_durations ?? null,
    resolutions: model.supported_resolutions ?? null,
    aspectRatios: model.supported_aspect_ratios ?? null,
    frameImages: model.supported_frame_images ?? null,
    generatesAudio: model.generate_audio ?? null,
    hasSeed: model.seed ?? null,
  }
}

onSecretsChange(() => {
  cache.clear()
  lastModels = []
})
