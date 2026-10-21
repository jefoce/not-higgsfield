import 'server-only'
import { randomInt, randomUUID } from 'node:crypto'
import { MAX_REQUEST_MB, REQUEST_RESERVE_MB, SEED_MAX, SUBMIT_GRACE_MS } from '@/core/constants'
import { inputForSubmit } from '@/core/normalize-input'
import { billableSeconds, estimateUsd, pricePerSec } from '@/core/pricing'
import { getPreset } from '@/core/presets'
import { canonicalizePrompt, referenceSlots } from '@/core/prompt-tokens'
import type { GenerationInput, GenerationRecord, ReferencePlan, UploadItem } from '@/core/types'
import { validateInput } from '@/core/validation'
import { encodeImages } from '../media/image-data-url'
import { getPricing } from '../openrouter/pricing'
import { getRemoteStore } from '../remote/remote-store'
import { getActiveCount, saveGeneration } from '../repos/generations'
import { loadUploads } from './run-submit'
import { startSubmit } from './submit-queue'

export class ValidationError extends Error {
  readonly status = 400
  readonly errors: string[]

  constructor(errors: string[]) {
    super(errors[0] ?? 'Invalid input')
    this.name = 'ValidationError'
    this.errors = errors
  }
}

/** Validates, writes a grace record, then queues upload and submit in the background. */
export async function createGeneration(raw: GenerationInput): Promise<GenerationRecord> {
  const preset = getPreset(raw.presetId)
  const base = inputForSubmit(raw)
  const uploads = await loadUploads(base)
  const input = withCanonicalPrompt(base, uploads)
  const validation = validateInput({
    input,
    uploads,
    preset,
    ctx: {
      activeCount: await getActiveCount(),
      remoteConfigured: getRemoteStore() !== null,
    },
  })
  if (!validation.ok) throw new ValidationError(validation.errors)

  const encoded = await encodeImages({
    uploads: Object.values(uploads),
    preset,
    budgetBytes: MAX_REQUEST_MB * 1024 * 1024 - REQUEST_RESERVE_MB * 1024 * 1024,
  })
  const pricing = await getPricing(preset)
  const hasVideoInput =
    input.tab === 'references' && input.references.some((id) => uploads[id]?.kind === 'video')
  const rate = pricePerSec({
    preset,
    ctx: {
      resolution: input.resolution,
      aspect: input.aspectRatio,
      audio: input.audio,
      hasVideoInput,
    },
    skus: pricing.skus,
  })
  const now = new Date().toISOString()
  const record: GenerationRecord = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'submitting',
    input: { ...input, frames: { ...input.frames }, references: [...input.references] },
    preset: { id: preset.id, title: preset.title, slug: preset.slug },
    inputsSnapshot: snapshot(uploads, encoded.plan),
    submit: {
      stage: 'grace',
      notBefore: new Date(Date.now() + SUBMIT_GRACE_MS).toISOString(),
    },
    seedUsed: input.seed ?? randomInt(0, SEED_MAX),
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: rate ?? 0,
      priceSource: rate == null ? 'unknown' : pricing.source,
      estimatedUsd: rate == null ? 0 : estimateUsd(rate, billableSeconds(preset, input.duration)),
      actualUsd: null,
      isByok: null,
      billed: null,
    },
  }
  const saved = await saveGeneration(record)
  await startSubmit(saved.id)
  return saved
}

/** Canonical prompt slots from reference order. */
function withCanonicalPrompt(
  input: GenerationInput,
  uploads: Record<string, UploadItem>,
): GenerationInput {
  const { counts } = referenceSlots(input.references, (id) => uploads[id]?.kind)
  const prompt = canonicalizePrompt(input.prompt, counts)
  return prompt === input.prompt ? input : { ...input, prompt }
}

function snapshot(
  uploads: Record<string, UploadItem>,
  plan: ReferencePlan,
): GenerationRecord['inputsSnapshot'] {
  const sent = new Map(plan.images.map((image) => [image.id, image]))
  return Object.fromEntries(
    Object.values(uploads).map((upload) => {
      const image = sent.get(upload.id)
      return [
        upload.id,
        {
          kind: upload.kind,
          originalName: upload.originalName,
          source: upload.source,
          target: upload.target,
          width: upload.width,
          height: upload.height,
          ...(image
            ? {
                sentWidth: image.width,
                sentHeight: image.height,
                sentBytes: image.bytes,
                format: image.format,
                flattened: image.flattened,
              }
            : {}),
        },
      ]
    }),
  )
}
