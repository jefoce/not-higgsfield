import 'server-only'

import type { VideoProviderId } from '@/core/providers/types'

import { createMockProvider } from './mock/provider'
import { isMockMode } from './openrouter/mock-mode'
import { createOpenRouterProvider } from './openrouter/provider'
import type { VideoProvider } from './types'

const providers = new Map<VideoProviderId, VideoProvider>()

const FACTORIES: { readonly [id in VideoProviderId]: () => VideoProvider } = {
  openrouter: createOpenRouterProvider,
}

/** True when the registry selects the mock adapter for this provider. */
export function isMockProvider(id: VideoProviderId): boolean {
  return id === 'openrouter' && isMockMode()
}

/** One configured adapter per provider id. */
export function getVideoProvider(id: VideoProviderId): VideoProvider {
  const existing = providers.get(id)

  if (existing) {
    return existing
  }

  const provider = isMockProvider(id) ? createMockProvider() : FACTORIES[id]()

  providers.set(id, provider)

  return provider
}
