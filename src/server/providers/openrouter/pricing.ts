import 'server-only'

import { isEmpty, isNil } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS, PRICING_FALLBACK_TTL_MS } from '@/core/constants'
import type { ModelPreset } from '@/core/presets/types'
import { primaryBinding } from '@/core/pricing'
import type { PricingInfo } from '@/core/types'

import { onSecretsChange } from '../../secrets'
import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'

const API_URL = 'https://openrouter.ai/api/v1'
const MODELS_URL = `${API_URL}/videos/models`
const LIVE_TTL_MS = 3_600_000

const ModelSchema = z
  .object({
    id: z.string(),
    pricing_skus: z.record(z.string(), z.unknown()).optional(),
  })
  .loose()

const ModelsSchema = z.object({ data: z.array(ModelSchema) }).loose()

const EndpointPricingSchema = z.object({ discount: z.number() }).loose()

const EndpointSchema = z.object({ pricing: EndpointPricingSchema.optional() }).loose()

const EndpointsDataSchema = z.object({ endpoints: z.array(EndpointSchema) }).loose()

const EndpointsSchema = z.object({ data: EndpointsDataSchema }).loose()

const cache = createTtlCache<PricingInfo>({
  key: 'pricing',
  okTtlMs: LIVE_TTL_MS,
  failTtlMs: PRICING_FALLBACK_TTL_MS,
})

/** List and discounted rates. Live results cache for an hour, fallback for five minutes. */
export async function getPricing(preset: ModelPreset, isForce = false): Promise<PricingInfo> {
  return cache.get(preset.id, () => loadPricing(preset), isForce)
}

async function loadPricing(preset: ModelPreset): Promise<TtlLoadResult<PricingInfo>> {
  const info = await fetchPricing(preset)

  return { value: info, isOk: info.source === 'live' }
}

function fallback(preset: ModelPreset): PricingInfo {
  const listSkus = { ...primaryBinding(preset).pricing.fallback }

  return {
    skus: { ...listSkus },
    listSkus,
    discount: 0,
    source: 'fallback',
    fetchedAt: new Date().toISOString(),
  }
}

/** A broken endpoints call keeps the live list rates at discount 0. */
async function fetchPricing(preset: ModelPreset): Promise<PricingInfo> {
  const [listSkus, discount] = await Promise.all([fetchListSkus(preset), fetchDiscount(preset)])

  if (!listSkus) {
    return fallback(preset)
  }

  let skus = { ...listSkus }

  if (discount > 0) {
    skus = applyDiscount(listSkus, discount)
  }

  return {
    skus,
    listSkus: { ...listSkus },
    discount,
    source: 'live',
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchListSkus(preset: ModelPreset): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(MODELS_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) {
      return null
    }

    const parsed = ModelsSchema.safeParse(await res.json())

    if (!parsed.success) {
      return null
    }

    const model = parsed.data.data.find((item) => item.id === primaryBinding(preset).modelId)

    if (model) {
      return readSkus(model.pricing_skus)
    }

    return null
  } catch {
    return null
  }
}

async function fetchDiscount(preset: ModelPreset): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/models/${primaryBinding(preset).modelId}/endpoints`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) {
      return 0
    }

    const parsed = EndpointsSchema.safeParse(await res.json())

    if (!parsed.success) {
      return 0
    }

    // Reads the first endpoint. Each model has one provider today, add per-endpoint pricing before a second provider.
    const raw = parsed.data.data.endpoints[0]?.pricing?.discount

    if (!isNil(raw) && raw >= 0 && raw <= 1) {
      return raw
    }

    return 0
  } catch {
    return 0
  }
}

/** Keeps six significant digits so sub-cent token rates keep their precision. */
function applyDiscount(listSkus: Record<string, number>, discount: number): Record<string, number> {
  const skus: Record<string, number> = {}

  for (const [key, value] of Object.entries(listSkus)) {
    skus[key] = Number((value * (1 - discount)).toPrecision(6))
  }

  return skus
}

/** Converts every SKU value to a number, dropping non-finite entries. */
function readSkus(skus: Record<string, unknown> | undefined): Record<string, number> | null {
  if (!skus) {
    return null
  }

  const result: Record<string, number> = {}

  for (const [key, raw] of Object.entries(skus)) {
    const value = Number(raw)

    if (Number.isFinite(value)) {
      result[key] = value
    }
  }

  if (isEmpty(result)) {
    return null
  }

  return result
}

onSecretsChange(() => {
  cache.clear()
})
