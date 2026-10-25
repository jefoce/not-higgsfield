import { z } from 'zod'

import { ASPECT_RATIOS, RESOLUTIONS } from '../presets/types'
import { VIDEO_PROVIDER_IDS } from '../providers/types'
import { MediaKindSchema, UploadSourceSchema } from './upload-item'

export const GeneratorTabSchema = z.enum(['frames', 'references'])
export type GeneratorTab = z.infer<typeof GeneratorTabSchema>

export const JobStatusSchema = z.enum([
  'submitting',
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'expired',
])

export type JobStatus = z.infer<typeof JobStatusSchema>

const PriceSourceSchema = z.enum(['live', 'fallback', 'mock', 'unknown'])

export const FrameSlotsSchema = z.object({
  start: z.string().nullable(),
  end: z.string().nullable(),
})

const AspectChoiceSchema = z.enum([...ASPECT_RATIOS, 'auto'])
const ResolutionSchema = z.enum(RESOLUTIONS)

export const GenerationInputSchema = z.object({
  presetId: z.string(),
  tab: GeneratorTabSchema,
  prompt: z.string(),
  audio: z.boolean(),
  duration: z.number(),
  aspectRatio: AspectChoiceSchema,
  resolution: ResolutionSchema,
  frames: FrameSlotsSchema,
  references: z.array(z.string()),
  seed: z.number().nullable(),
})

export type GenerationInput = z.infer<typeof GenerationInputSchema>

export const RecordPresetSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
})

export const RecordSubmitSchema = z.object({
  stage: z.enum(['grace', 'uploading', 'sending']),
  notBefore: z.string().optional(),
  progress: z.number().optional(),
})

export const RecordJobSchema = z.object({
  id: z.string(),
  generationId: z.string().optional(),
  submittedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  expiresAt: z.number().optional(),
})

export const RecordDownloadSchema = z.object({
  startedAt: z.string(),
})

export const RecordOutputSchema = z.object({
  video: z.string(),
  preview: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSec: z.number().optional(),
  bytes: z.number().optional(),
})

const SnapshotItemSchema = z.object({
  kind: MediaKindSchema,
  originalName: z.string(),
  source: UploadSourceSchema,
  target: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  transport: z.enum(['base64', 'url']).optional(),
  sentWidth: z.number().optional(),
  sentHeight: z.number().optional(),
  sentBytes: z.number().optional(),
  format: z.enum(['jpeg', 'png']).optional(),
  flattened: z.enum(['#ffffff', '#1c1e20']).optional(),
})

export const InputSnapshotSchema = z.record(z.string(), SnapshotItemSchema)

export const GenerationCostSchema = z.object({
  currency: z.literal('USD'),
  pricePerSec: z.number(),
  priceSource: PriceSourceSchema,
  estimatedUsd: z.number(),
  actualUsd: z.number().nullable(),
  isByok: z.boolean().nullable(),
  billed: z.boolean().nullable(),
})

/** One generation stored in `downloads/<uuid>.json`. */
export const GenerationRecordSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: JobStatusSchema,
  provider: z.enum(VIDEO_PROVIDER_IDS).optional(),
  input: GenerationInputSchema,
  preset: RecordPresetSchema,
  inputsSnapshot: InputSnapshotSchema,
  submit: RecordSubmitSchema.optional(),
  job: RecordJobSchema.optional(),
  download: RecordDownloadSchema.optional(),
  seedUsed: z.number().nullable(),
  favorite: z.boolean(),
  cost: GenerationCostSchema,
  output: RecordOutputSchema.optional(),
  error: z.string().optional(),
})

export type GenerationRecord = z.infer<typeof GenerationRecordSchema>
