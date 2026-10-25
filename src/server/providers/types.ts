import 'server-only'

import type { MediaKind } from '@/core/media-types'
import type { ModelPreset } from '@/core/presets/types'
import type { VideoProviderId } from '@/core/providers/types'
import type { GenerationInput, JobStatus, TestResult } from '@/core/types'

export interface ProviderModel {
  modelId: string
  durations: readonly number[] | null
  resolutions: readonly string[] | null
  aspectRatios: readonly string[] | null
  frameImages: readonly string[] | null
  generatesAudio: boolean | null
  hasSeed: boolean | null
}

export interface ResolvedMedia {
  id: string
  kind: MediaKind
  url: string
}

export interface SubmitJobParams {
  preset: ModelPreset
  input: GenerationInput
  media: Readonly<Record<string, ResolvedMedia>>
}

export interface SubmittedJob {
  jobId: string
  status: JobStatus
}

export interface JobRef {
  jobId: string
  submittedAt: string
}

export interface JobUsage {
  costUsd: number | null
  isByok: boolean | null
}

export interface JobSnapshot {
  status: JobStatus
  generationId: string | null
  expiresAt: number | null
  usage: JobUsage | null
  error: string | null
}

export interface ContentFallback {
  presetId: string
  duration: number
  resolution: string
  aspectRatio: string
}

export interface ContentRequest {
  job: JobRef
  index: number
  fallback: ContentFallback | null
}

export type AccountSource = 'management' | 'key' | 'mock' | 'none'

export interface ProviderAccount {
  balance: number | null
  keyLimitRemaining: number | null
  keyLimit: number | null
  usageDaily: number | null
  usageMonthly: number | null
  source: AccountSource
  error: string | null
}

export interface VideoProvider {
  readonly id: VideoProviderId
  isConfigured(): boolean
  submit(params: SubmitJobParams): Promise<SubmittedJob>
  getJob(job: JobRef): Promise<JobSnapshot>
  fetchContent(request: ContentRequest): Promise<Response>
  getAccount(): Promise<ProviderAccount>
  testConnection(): Promise<TestResult>
}
