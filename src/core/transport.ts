import type { MediaKind } from './media-types'
import type { ProviderBinding } from './presets/types'

export type ResolvedTransport = 'base64' | 'url'

interface ResolveTransportParams {
  binding: ProviderBinding
  kind: MediaKind
  remoteConfigured: boolean
}

/** Explicit transport wins. `auto` uses url only when remote storage is configured. */
export function resolveTransport(params: ResolveTransportParams): ResolvedTransport {
  const { binding, kind, remoteConfigured: isRemoteConfigured } = params
  const transport = binding.transport[kind]

  if (transport !== 'auto') {
    return transport
  }

  if (isRemoteConfigured) {
    return 'url'
  }

  return 'base64'
}
