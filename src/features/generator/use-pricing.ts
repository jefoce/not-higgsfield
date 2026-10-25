'use client'

import useSWR from 'swr'

import type { PricingInfo } from '@/core/types'
import { fetchPricing, pricingKey } from '@/lib/api/generations'

import { useGeneratorStore } from './store/store'

/** Live SKU prices for the draft preset, refreshed hourly. Pass an id to price another model. */
export function usePricing(presetIdOverride?: string) {
  const storePresetId = useGeneratorStore((state) => state.presetId)
  const presetId = presetIdOverride ?? storePresetId

  const { data: pricing } = useSWR<PricingInfo>(pricingKey(presetId), fetchPricing, {
    refreshInterval: 3_600_000,
  })

  return { pricing }
}
