import type { PresetPricing, Resolution } from './types'

/** Fixed per-second USD rate keyed by resolution. */
export const perSecondPricing = (fallback: Record<string, number>): PresetPricing => ({
  kind: 'perSecond',
  unit: 'usd',
  key: (resolution) => `duration_seconds_${resolution}`,
  fallback,
})

/** Video token cost per pixel-second at the provider's frame rate. */
export const videoTokenPricing = (
  key: (resolution: Resolution, audio: boolean, hasVideoInput: boolean) => string,
  fallback: Record<string, number>,
): PresetPricing => ({ kind: 'videoTokens', fps: 24, key, fallback })
