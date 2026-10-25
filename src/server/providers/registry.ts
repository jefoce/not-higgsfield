import 'server-only'

/**
 * Reads the mock flag the way the adapters will.
 * getVideoProvider and activeBinding land with the adapters.
 */
export function isMockMode(): boolean {
  return process.env.OPENROUTER_MOCK === '1'
}
