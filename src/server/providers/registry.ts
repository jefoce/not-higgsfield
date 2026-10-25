import 'server-only'

import type { VideoProviderId } from '@/core/providers/types'

import { isMockMode as isProviderMockMode } from './openrouter/mock-mode'
import { createOpenRouterProvider } from './openrouter/provider'
import type { VideoProvider } from './types'

const providers = new Map<VideoProviderId, VideoProvider>()

const FACTORIES: { readonly [id in VideoProviderId]: () => VideoProvider } = {
  openrouter: createOpenRouterProvider,
}

export function isMockMode(): boolean {
  return isProviderMockMode()
}

/** One configured adapter per provider id. */
export function getVideoProvider(id: VideoProviderId): VideoProvider {
  const existing = providers.get(id)

  if (existing) {
    return existing
  }

  const provider = FACTORIES[id]()

  providers.set(id, provider)

  return provider
}
