import 'server-only'

import { isNil } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'
import { referenceVideoSeconds } from '@/core/duration-limits'
import { inputForSubmit } from '@/core/normalize-input'
import { getPreset } from '@/core/presets'
import { activeBinding } from '@/core/presets/bindings'
import type { ModelPreset } from '@/core/presets/types'
import { estimatePrice, type PriceContext } from '@/core/pricing'
import { canonicalizePrompt, referenceSlots } from '@/core/prompt-tokens'
import type { GenerationInput } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { GenerationEstimate } from '@/core/types'
import { type PriceInput, validateInput } from '@/core/validation'

import { ValidationError } from '../errors'
import { getVideoProvider } from '../providers/registry'
import { getActiveCount } from '../repos/generations'
import { getModelCatalog } from '../services/model-catalog'
import { getObjectStore } from '../storage/registry'
import { loadUploads } from './run-submit'

export interface GenerationDraft {
  preset: ModelPreset
  input: GenerationInput
  uploads: Record<string, UploadItem>
}

/** Validates one draft and loads only its referenced uploads. */
export async function loadDraft(raw: GenerationInput): Promise<GenerationDraft> {
  const preset = getPreset(raw.presetId)
  const entry = await loadCatalogEntry(preset.id)
  const base = inputForSubmit(raw)
  const uploads = await loadUploads(base)
  const input = withCanonicalPrompt(base, uploads)

  const validation = validateInput({
    input,
    uploads,
    preset,
    ctx: {
      activeCount: await getActiveCount(),
      remoteConfigured: !isNil(getObjectStore()),
      modelStatus: entry?.status ?? 'unverified',
      modelReason: entry?.reason ?? null,
    },
  })

  if (!validation.ok) {
    throw new ValidationError(validation.errors)
  }

  return { preset, input, uploads }
}

/** Uploads for a price-only draft. No validation, active count, remote or secrets. */
export async function loadPriceDraft(raw: PriceInput): Promise<GenerationDraft> {
  const preset = getPreset(raw.presetId)

  await loadCatalogEntry(preset.id)
  const input = inputForSubmit({ ...raw, prompt: '', seed: null })
  const uploads = await loadUploads(input)

  return { preset, input, uploads }
}

/** Missing and unconfigured models fail loudly. Unverified ones proceed. */
async function loadCatalogEntry(presetId: string): Promise<CatalogEntry | undefined> {
  const { entries } = await getModelCatalog()
  const entry = entries.find((item) => item.presetId === presetId)

  if (isNil(entry)) {
    return undefined
  }

  if (entry.status === 'missing' || entry.status === 'no_provider') {
    throw new ValidationError([entry.reason ?? 'Model unavailable'])
  }

  return entry
}

/** Discounted and list totals for a validated draft. */
export async function estimateGeneration(draft: GenerationDraft): Promise<GenerationEstimate> {
  const { preset, input, uploads } = draft
  const binding = activeBinding(preset, (item) => getVideoProvider(item.provider).isConfigured())
  const pricing = await getVideoProvider(binding.provider).getPricing(preset)

  const hasVideoInput =
    input.tab === 'references' && input.references.some((id) => uploads[id]?.kind === 'video')

  const ctx: PriceContext = {
    resolution: input.resolution,
    aspect: input.aspectRatio,
    audio: input.audio,
    hasVideoInput,
  }

  const refSeconds = referenceVideoSeconds({ references: input.references, uploads })

  const estimate = estimatePrice({
    preset,
    ctx,
    duration: input.duration,
    referenceSeconds: refSeconds,
    skus: pricing.skus,
  })

  if (isNil(estimate)) {
    return {
      estimatedUsd: 0,
      listUsd: 0,
      pricePerSec: 0,
      priceSource: 'unknown',
      discount: pricing.discount,
    }
  }

  const list =
    pricing.discount > 0
      ? estimatePrice({
          preset,
          ctx,
          duration: input.duration,
          referenceSeconds: refSeconds,
          skus: pricing.listSkus,
        })
      : null

  return {
    estimatedUsd: estimate.estimatedUsd,
    listUsd: list?.estimatedUsd ?? estimate.estimatedUsd,
    pricePerSec: estimate.pricePerSec,
    priceSource: pricing.source,
    discount: pricing.discount,
  }
}

/** Canonical prompt slots from reference order. */
function withCanonicalPrompt(
  input: GenerationInput,
  uploads: Record<string, UploadItem>,
): GenerationInput {
  const { counts } = referenceSlots(input.references, (id) => uploads[id]?.kind)
  const prompt = canonicalizePrompt(input.prompt, counts)

  if (prompt === input.prompt) {
    return input
  }

  return { ...input, prompt }
}
