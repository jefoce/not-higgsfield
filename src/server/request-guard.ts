import 'server-only'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

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

import { hasSession } from './session'

/** Rejects non-local hosts, cross-site writes, foreign origins and missing desktop sessions. */
export function assertLocalRequest(request: Request, opts: { session?: boolean } = {}): void {
  const host = (request.headers.get('host') ?? '').replace(/:\d+$/, '')
  if (!LOCAL_HOSTS.has(host)) throw new HttpError(403, 'Forbidden host')

  const site = request.headers.get('sec-fetch-site')
  const origin = request.headers.get('origin')
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (site && site !== 'same-origin' && site !== 'none') {
      throw new HttpError(403, 'Cross-site request')
    }
    if (origin && !LOCAL_HOSTS.has(new URL(origin).hostname)) {
      throw new HttpError(403, 'Bad origin')
    }
  }

  if (opts.session !== false && !hasSession(request)) throw new HttpError(401, 'No session')
}

/** Parses a JSON body, requiring an application/json content type. */
export async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new HttpError(415, 'JSON required')
  }
  try {
    return (await request.json()) as unknown
  } catch {
    throw new RequestBodyError()
  }
}
