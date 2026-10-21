import { streamFile } from '@/server/fs/range-response'
import { assertLocalRequest, errorResponse, jsonError } from '@/server/http'
import { mockObjectPath, verifyMockSignature } from '@/server/remote/mock'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ key: string[] }> }

export async function GET(request: Request, { params }: Params) {
  const { key } = await params
  return handle(request, key)
}

export async function HEAD(request: Request, { params }: Params) {
  const { key } = await params
  return handle(request, key)
}

/** Serves an object from the mock remote store, signed and short lived. */
async function handle(request: Request, keyParts: string[]): Promise<Response> {
  if (!process.env.REMOTE_MOCK?.trim()) return new Response('Not found', { status: 404 })
  try {
    assertLocalRequest(request, { session: false })
    const key = keyParts.join('/')
    const url = new URL(request.url)
    const exp = Number(url.searchParams.get('exp'))
    const sig = url.searchParams.get('sig') ?? ''
    if (!verifyMockSignature({ key, exp, sig })) {
      return jsonError({ status: 403, error: 'Invalid or expired link' })
    }

    const file = mockObjectPath(key)
    if (!file) return jsonError({ status: 404, error: 'Object not found' })
    const response = await streamFile({
      absPath: file,
      request,
      opts: { cacheControl: 'private, max-age=0, must-revalidate' },
    })
    return response.status === 404 ? jsonError({ status: 404, error: 'Object not found' }) : response
  } catch (error) {
    return errorResponse(error)
  }
}
