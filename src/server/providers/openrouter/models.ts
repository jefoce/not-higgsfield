import 'server-only'

import { z } from 'zod'

import { FETCH_TIMEOUTS, PRICING_FALLBACK_TTL_MS } from '@/core/constants'

import { globalState } from '../../global-state'
import { onSecretsChange } from '../../secrets'
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

interface CacheEntry {
  models: readonly ProviderModel[]
  at: number
  isFallback: boolean
}

const cache = globalState('providerModels', () => ({ entry: undefined as CacheEntry | undefined }))

/** Live model capabilities. A good result caches for an hour, a failure for five minutes. */
export async function listModels(): Promise<ProviderModelList> {
  const cached = cache.entry
  const ttl = cached?.isFallback === true ? PRICING_FALLBACK_TTL_MS : LIVE_TTL_MS

  if (cached && Date.now() - cached.at < ttl) {
    return { models: cached.models, isFresh: !cached.isFallback }
  }

  try {
    const models = await fetchModels()

    cache.entry = { models, at: Date.now(), isFallback: false }

    return { models, isFresh: true }
  } catch {
    const models = cached?.models ?? []

    cache.entry = { models, at: Date.now(), isFallback: true }

    return { models, isFresh: false }
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
  cache.entry = undefined
})
