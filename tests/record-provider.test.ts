import { describe, expect, it } from 'vitest'

import { recordProvider } from '@/core/providers/registry'
import { VIDEO_PROVIDER_IDS } from '@/core/providers/types'

describe('recordProvider', () => {
  it('falls back to the default provider for old records', () => {
    expect(recordProvider({})).toBe(VIDEO_PROVIDER_IDS[0])
  })

  it('returns the stored provider', () => {
    expect(recordProvider({ provider: VIDEO_PROVIDER_IDS[0] })).toBe(VIDEO_PROVIDER_IDS[0])
  })
})
