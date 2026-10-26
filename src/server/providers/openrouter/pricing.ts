import 'server-only'

import { isEmpty, isNil } from 'lodash-es'
import { z } from 'zod'

import { FETCH_TIMEOUTS, PRICING_FALLBACK_TTL_MS } from '@/core/constants'
import { messageOf } from '@/core/errors'
import { primaryBinding } from '@/core/presets/bindings'
import type { ModelPreset } from '@/core/presets/types'
import type { PricingInfo } from '@/core/types'
import type { Dict } from '@/core/utility-types'

import { onSecretsChange } from '../../secrets'
import { createTtlCache, type TtlLoadResult } from '../../sync/ttl-cache'
import { fetchVideoModels } from './video-models'

const API_URL = 'https://openrouter.ai/api/v1'
const LIVE_TTL_MS = 3_600_000

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
  return cache.get(
    preset.id,
    () => {
      return loadPricing(preset, isForce)
    },
    isForce,
  )
}

async function loadPricing(
  preset: ModelPreset,
  isForce: boolean,
): Promise<TtlLoadResult<PricingInfo>> {
  const info = await fetchPricing(preset, isForce)

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
async function fetchPricing(preset: ModelPreset, isForce: boolean): Promise<PricingInfo> {
  const [listSkus, discount] = await Promise.all([
    fetchListSkus(preset, isForce),
    fetchDiscount(preset),
  ])

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

async function fetchListSkus(preset: ModelPreset, isForce: boolean): Promise<Dict<number> | null> {
  try {
    const models = await fetchVideoModels(isForce)

    const model = models.find((item) => {
      return item.id === primaryBinding(preset).modelId
    })

    if (isNil(model)) {
      return null
    }

    return readSkus(model.pricing_skus)
  } catch {
    return null
  }
}

/** Reads the live fraction. One warning per fallback, never the URL or headers. */
export async function fetchDiscount(preset: ModelPreset): Promise<number> {
  const { modelId } = primaryBinding(preset)

  try {
    const res = await fetch(`${API_URL}/models/${modelId}/endpoints`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.meta),
    })

    if (!res.ok) {
      warnDiscount({ preset, modelId, reason: `HTTP ${res.status}` })

      return 0
    }

    const parsed = EndpointsSchema.safeParse(await res.json())

    if (!parsed.success) {
      const reason = `invalid response (${issueSummary(parsed.error)})`

      warnDiscount({ preset, modelId, reason })

      return 0
    }

    // Reads the first endpoint. Each model has one provider today, add per-endpoint pricing before a second provider.
    const raw = parsed.data.data.endpoints[0]?.pricing?.discount

    if (isNil(raw) || raw < 0 || raw > 1) {
      warnDiscount({ preset, modelId, reason: `discount ${String(raw)} out of range` })

      return 0
    }

    return raw
  } catch (error) {
    warnDiscount({ preset, modelId, reason: messageOf(error) })

    return 0
  }
}

interface DiscountWarningParams {
  preset: ModelPreset
  modelId: string
  reason: string
}

function warnDiscount(params: DiscountWarningParams): void {
  const { preset, modelId, reason } = params

  console.warn(`[pricing] ${preset.id} (${modelId}) discount fallback: ${reason}`)
}

function issueSummary(error: z.ZodError): string {
  const issues = error.issues.slice(0, 3).map((issue) => {
    const path = issue.path.join('.')
    const label = path === '' ? 'response' : path

    return `${label}: ${issue.message}`
  })

  return issues.join('; ')
}

/** Keeps six significant digits so sub-cent token rates keep their precision. */
function applyDiscount(listSkus: Dict<number>, discount: number): Dict<number> {
  const skus: Dict<number> = {}

  for (const [key, value] of Object.entries(listSkus)) {
    skus[key] = Number((value * (1 - discount)).toPrecision(6))
  }

  return skus
}

/** Converts every SKU value to a number, dropping non-finite entries. */
function readSkus(skus: Dict<unknown> | undefined): Dict<number> | null {
  if (!skus) {
    return null
  }

  const result: Dict<number> = {}

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
