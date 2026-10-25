import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MODEL_PRESETS } from '@/core/presets'
import { primaryBinding } from '@/core/pricing'
import type { ProviderModel } from '@/server/providers/types'
import { getModelCatalog } from '@/server/services/model-catalog'

const mocks = vi.hoisted(() => {
  const pricing = {
    skus: {},
    listSkus: {},
    discount: 0,
    source: 'live' as const,
    fetchedAt: '',
  }

  return {
    getPricing: vi.fn(async () => pricing),
    isConfigured: vi.fn(() => true),
    isMockMode: vi.fn(() => false),
    listModels: vi.fn(async (): Promise<readonly ProviderModel[]> => []),
  }
})

vi.mock('@/server/providers/registry', () => ({
  getVideoProvider: () => ({
    getPricing: mocks.getPricing,
    isConfigured: mocks.isConfigured,
    listModels: mocks.listModels,
  }),
}))

vi.mock('@/server/providers/openrouter/mock-mode', () => ({
  isMockMode: () => mocks.isMockMode(),
}))

vi.mock('@/server/secrets', () => ({
  secretsReady: vi.fn(async () => {}),
}))

function model(modelId: string): ProviderModel {
  return {
    modelId,
    durations: null,
    resolutions: null,
    aspectRatios: null,
    frameImages: null,
    generatesAudio: null,
    hasSeed: null,
  }
}

const allPresetModels = (): ProviderModel[] =>
  MODEL_PRESETS.map((preset) => model(primaryBinding(preset).modelId))

beforeEach(() => {
  mocks.getPricing.mockClear()
  mocks.isConfigured.mockReturnValue(true)
  mocks.isMockMode.mockReturnValue(false)
  mocks.listModels.mockReset()
  mocks.listModels.mockResolvedValue([])
})

describe('getModelCatalog status', () => {
  it('marks a model present in the live list as available', async () => {
    mocks.listModels.mockResolvedValue(allPresetModels())

    const { entries } = await getModelCatalog()

    expect(entries.every((entry) => entry.status === 'available')).toBe(true)
    expect(entries.every((entry) => entry.reason === null)).toBe(true)
  })

  it('marks an absent model as missing with the provider label', async () => {
    mocks.listModels.mockResolvedValue([model('other/model')])

    const { entries } = await getModelCatalog()

    expect(entries.every((entry) => entry.status === 'missing')).toBe(true)
    expect(entries[0]?.reason).toBe('Not available on OpenRouter right now.')
  })

  it('marks an unreadable list as unverified without a reason', async () => {
    const { entries } = await getModelCatalog()

    expect(entries.every((entry) => entry.status === 'unverified')).toBe(true)
    expect(entries.every((entry) => entry.reason === null)).toBe(true)
  })

  it('marks every model no_provider when no key is configured', async () => {
    mocks.isConfigured.mockReturnValue(false)

    const { entries } = await getModelCatalog()

    expect(entries.every((entry) => entry.status === 'no_provider')).toBe(true)
    expect(entries[0]?.reason).toBe('Add your OpenRouter key in Settings.')
    expect(mocks.listModels).not.toHaveBeenCalled()
  })

  it('marks every model available in mock mode without a fetch', async () => {
    mocks.isMockMode.mockReturnValue(true)

    const { entries } = await getModelCatalog()

    expect(entries.every((entry) => entry.status === 'available')).toBe(true)
    expect(mocks.listModels).not.toHaveBeenCalled()
  })
})
