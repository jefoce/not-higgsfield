import 'server-only'

import { z } from 'zod'

import { FETCH_TIMEOUTS, PRICING_FALLBACK_TTL_MS } from '@/core/constants'
import { MODEL_PRESETS } from '@/core/presets'
import type { ModelPreset } from '@/core/presets/types'

import { globalState } from '../../global-state'
import { onSecretsChange } from '../../secrets'
import type { ProviderModel } from '../types'
import { BASE_URL } from './http'
import { isMockMode } from './mock-mode'

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
export async function listModels(): Promise<readonly ProviderModel[]> {
  if (isMockMode()) {
    return MODEL_PRESETS.map(staticModel)
  }

  const cached = cache.entry
  const ttl = cached?.isFallback === true ? PRICING_FALLBACK_TTL_MS : LIVE_TTL_MS

  if (cached && Date.now() - cached.at < ttl) {
    return cached.models
  }

  try {
    const models = await fetchModels()

    cache.entry = { models, at: Date.now(), isFallback: false }

    return models
  } catch {
    const models = cached?.models ?? []

    cache.entry = { models, at: Date.now(), isFallback: true }

    return models
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

function staticModel(preset: ModelPreset): ProviderModel {
  return {
    modelId: preset.slug,
    durations: preset.duration.options ?? allDurations(preset),
    resolutions: preset.resolutions,
    aspectRatios: preset.aspectRatios,
    frameImages: frameImages(preset),
    generatesAudio: preset.audio.supported,
    hasSeed: preset.seed,
  }
}

function allDurations(preset: ModelPreset): number[] {
  const { min, max } = preset.duration

  return Array.from({ length: max - min + 1 }, (_, index) => min + index)
}

function frameImages(preset: ModelPreset): readonly string[] | null {
  if (!preset.frames.start) {
    return null
  }

  if (!preset.frames.end) {
    return ['first_frame']
  }

  return ['first_frame', 'last_frame']
}

onSecretsChange(() => {
  cache.entry = undefined
})
