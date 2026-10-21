import type { ModelPreset } from './presets'
import type { MediaKind } from './types'

export type ResolvedTransport = 'base64' | 'url'

interface ResolveTransportParams {
  preset: ModelPreset
  kind: MediaKind
  remoteConfigured: boolean
}

/** Explicit transport wins. `auto` uses url only when remote storage is configured. */
export function resolveTransport(params: ResolveTransportParams): ResolvedTransport {
  const { preset, kind, remoteConfigured } = params
  const transport = preset.inputTransport[kind]
  if (transport !== 'auto') return transport
  return remoteConfigured ? 'url' : 'base64'
}
