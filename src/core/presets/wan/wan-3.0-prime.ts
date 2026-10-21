import { wanPreset } from './family'

export const WAN_30_PRIME = wanPreset({
  id: 'wan-3.0-prime',
  title: 'Wan 3.0 Prime',
  slug: 'alibaba/wan-3.0-prime',
  fallback: {
    duration_seconds_480p: 0.068,
    duration_seconds_720p: 0.14,
    duration_seconds_1080p: 0.28,
  },
})
