import type { GenerationRecord } from '@/core/types'

type StoredRecordOverrides = Partial<Omit<GenerationRecord, 'schemaVersion'>>

export function storedRecord(id: string, overrides: StoredRecordOverrides = {}): GenerationRecord {
  return {
    schemaVersion: 1,
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'completed',
    input: {
      presetId: 'seedance-2.0',
      tab: 'references',
      prompt: 'A cat',
      audio: true,
      duration: 4,
      aspectRatio: '16:9',
      resolution: '1080p',
      frames: { start: null, end: null },
      references: [],
      seed: null,
    },
    preset: { id: 'seedance-2.0', title: 'Seedance', slug: 'seedance' },
    inputsSnapshot: {},
    seedUsed: 1,
    favorite: false,
    cost: {
      currency: 'USD',
      pricePerSec: 0,
      priceSource: 'mock',
      estimatedUsd: 0,
      actualUsd: 0,
      isByok: false,
      billed: true,
    },
    ...overrides,
  }
}
