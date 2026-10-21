/** Thrown for any non-2xx API response. */
export class ApiError extends Error {
  readonly status: number
  readonly details?: string[]

  constructor(status: number, message: string, details?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

interface ErrorBody {
  error?: string
  details?: string[]
}

async function throwApiError(response: Response): Promise<never> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null
  throw new ApiError(
    response.status,
    body?.error ?? response.statusText ?? `Request failed (${response.status})`,
    body?.details,
  )
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

/** SWR fetcher: GET with same-origin credentials. */
export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: 'GET', credentials: 'same-origin' })
  if (!response.ok) return throwApiError(response)
  return readJson<T>(response)
}

/** JSON request helper. Adds JSON headers unless the body is FormData. */
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const isForm = init?.body instanceof FormData
  if (init?.body && !isForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(url, { credentials: 'same-origin', ...init, headers })
  if (!response.ok) return throwApiError(response)
  return readJson<T>(response)
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return apiRequest<T>(url, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
}

export function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return apiRequest<T>(url, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) })
}

export function apiDelete<T>(url: string, body?: unknown): Promise<T> {
  return apiRequest<T>(url, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) })
}
