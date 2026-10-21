import 'server-only'

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: string[],
  ) {
    super(message)
    this.name = 'OpenRouterError'
  }
}
