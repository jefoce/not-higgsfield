import { isNil } from 'lodash-es'

import type { ReferencePlan } from '@/core/media-types'
import type { GenerationInput, GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { BatchSkip, GenerationEstimate, GenerationListResult } from '@/core/types'
import { apiDelete, apiPatch, apiPost, fetcher } from '@/lib/fetcher'
import type { GenerationEstimateKey } from '@/lib/swr-keys'

export function createGeneration(input: GenerationInput): Promise<GenerationRecord> {
  return apiPost<GenerationRecord>('/api/generations', input)
}

export function fetchEstimate(key: GenerationEstimateKey): Promise<GenerationEstimate> {
  const [url, json] = key

  return apiPost<GenerationEstimate>(url, JSON.parse(json) as unknown)
}

export function cancelGenerationRequest(id: string): Promise<void> {
  return apiPost<void>(`/api/generations/${id}/cancel`)
}

export function setFavorite(id: string, isFavorite: boolean): Promise<GenerationRecord> {
  return apiPatch<GenerationRecord>(`/api/generations/${id}`, { favorite: isFavorite })
}

export interface BatchResult {
  done: string[]
  skipped: BatchSkip[]
}

export function batchGenerations(
  ids: string[],
  body: Record<string, unknown>,
): Promise<BatchResult> {
  return apiPost<BatchResult>('/api/generations/batch', { ...body, ids })
}

interface ExportRecordParams {
  id: string
  path: string
}

export function exportRecord(params: ExportRecordParams): Promise<void> {
  const { id, path } = params

  return apiPost<void>(`/api/generations/${id}/export`, { path, overwrite: true })
}

export interface ExportBatchResult {
  saved: string[]
}

interface ExportBatchParams {
  ids: string[]
  dir: string
}

export function exportBatch(params: ExportBatchParams): Promise<ExportBatchResult> {
  const { ids, dir } = params

  return apiPost<ExportBatchResult>('/api/generations/export-batch', { ids, dir })
}

export function fetchUploadsByIds(ids: string[]): Promise<UploadItem[]> {
  return fetcher<UploadItem[]>(`/api/uploads?ids=${ids.map(encodeURIComponent).join(',')}`)
}

interface GenerationPageKeyParams {
  query: string
  index: number
  previous: GenerationListResult | null
}

/** SWR key for one history page, null when the previous page is the last one. */
export function generationPageKey(params: GenerationPageKeyParams): string | null {
  const { query, index, previous } = params

  if (index > 0 && isNil(previous?.nextCursor)) {
    return null
  }

  const search = new URLSearchParams(query)

  if (index > 0 && !isNil(previous?.nextCursor)) {
    search.set('cursor', previous.nextCursor)
  }

  return `/api/generations?${search.toString()}`
}

export function fetchGenerationPage(key: string): Promise<GenerationListResult> {
  return fetcher<GenerationListResult>(key)
}

export function fetchGenerationsByIds(ids: string[]): Promise<GenerationListResult> {
  return fetcher<GenerationListResult>(
    `/api/generations?ids=${ids.map(encodeURIComponent).join(',')}`,
  )
}

export function requestReferencePlan(presetId: string, ids: string[]): Promise<ReferencePlan> {
  return apiPost<ReferencePlan>('/api/references/plan', { presetId, ids })
}

export function deleteGeneration(id: string): Promise<void> {
  return apiDelete<void>(`/api/generations/${id}`)
}

export function captureGenerationFrame(id: string, at: 'first' | 'last'): Promise<UploadItem> {
  return apiPost<UploadItem>(`/api/generations/${id}/frame`, { at })
}

export function revealGeneration(id: string): Promise<void> {
  return apiPost<void>(`/api/generations/${id}/reveal`)
}
