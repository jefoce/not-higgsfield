import 'server-only'

/** Message from a caught value, with a fallback for non-errors. */
export function messageOf(error: unknown, fallback = 'Request failed'): string {
  return error instanceof Error ? error.message : fallback
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class RequestBodyError extends HttpError {
  constructor() {
    super(400, 'Invalid JSON body')
  }
}

export class ValidationError extends Error {
  readonly status = 400
  readonly errors: string[]

  constructor(errors: string[]) {
    super(errors[0] ?? 'Invalid input')
    this.name = 'ValidationError'
    this.errors = errors
  }
}

export class UploadError extends HttpError {}
