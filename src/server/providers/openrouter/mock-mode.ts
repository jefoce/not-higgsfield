import 'server-only'

/** Mock flag shared by the OpenRouter adapters without importing the registry. */
export function isMockMode(): boolean {
  return process.env.OPENROUTER_MOCK === '1'
}
