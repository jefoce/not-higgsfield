import path from 'node:path'
import { resolveMediaRef } from '@/server/fs/media-ref'
import { streamFile } from '@/server/fs/range-response'
import { assertLocalRequest, errorResponse, jsonError } from '@/server/http'
import { CompatError, getCompatMedia } from '@/server/media/compat'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ ref: string[] }> }

/** Download names are immutable uuids; uploads and folders can change. */
function cacheControlFor(ref: string, compat: boolean): string {
  if (compat) return 'private, max-age=3600'
  if (ref.startsWith('downloads/')) return 'private, max-age=31536000, immutable'
  return 'private, max-age=0, must-revalidate'
}

export async function GET(request: Request, { params }: Params) {
  try {
    assertLocalRequest(request)
    const { ref } = await params
    const media = await resolveMediaRef(ref)
    const search = new URL(request.url).searchParams
    const download = search.get('download') === '1'
    const compatKind = search.get('compat') === '1' && media.kind !== 'image' ? media.kind : null
    const target = compatKind
      ? await getCompatMedia({ absPath: media.absolutePath, kind: compatKind, ref: media.ref })
      : null

    const response = await streamFile({
      absPath: target?.path ?? media.absolutePath,
      request,
      opts: {
        downloadName: download ? path.basename(media.absolutePath) : undefined,
        cacheControl: cacheControlFor(media.ref, Boolean(target)),
      },
    })
    return response.status === 404 ? jsonError({ status: 404, error: 'File not found' }) : response
  } catch (error) {
    if (error instanceof CompatError) return jsonError({ status: error.status, error: error.message })
    return errorResponse(error)
  }
}
