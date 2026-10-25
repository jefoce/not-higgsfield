import type { ModelPreset, ProviderBinding } from './types'

/**
 * First binding whose provider is configured, else the primary binding.
 * `isConfigured` keeps core free of server imports.
 */
export function activeBinding(
  preset: ModelPreset,
  isConfigured: (binding: ProviderBinding) => boolean,
): ProviderBinding {
  return preset.bindings.find(isConfigured) ?? preset.bindings[0]
}
