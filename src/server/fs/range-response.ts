import 'server-only'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { mimeFromExt } from '@/core/media-kinds'

interface StreamOptions {
  downloadName?: string
  cacheControl?: string
}

interface StreamFileParams {
  absPath: string
  request: Request
  opts?: StreamOptions
}

export async function streamFile(params: StreamFileParams): Promise<Response> {
  const { absPath, request, opts = {} } = params
  let stats
  try {
    stats = await fs.stat(absPath)
    if (!stats.isFile()) return notFound()
  } catch {
    return notFound()
  }
  const size = stats.size

  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Type': mimeFromExt(path.extname(absPath)) ?? 'application/octet-stream',
  })
  if (opts.cacheControl) headers.set('Cache-Control', opts.cacheControl)
  if (opts.downloadName) {
    headers.set('Content-Disposition', `attachment; filename="${sanitizeName(opts.downloadName)}"`)
  }

  const etag = `W/"${size}-${Math.floor(stats.mtimeMs)}"`
  headers.set('ETag', etag)
  headers.set('Last-Modified', stats.mtime.toUTCString())
  if (isNotModified(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers })
  }

  const rangeHeader = request.headers.get('range')
  const range = rangeHeader ? parseRange(rangeHeader, size) : null
  if (rangeHeader && !range) {
    headers.set('Content-Range', `bytes */${size}`)
    headers.set('Content-Length', '0')
    return new Response(null, { status: 416, headers })
  }

  const length = range ? range.end - range.start + 1 : size
  headers.set('Content-Length', String(length))
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)

  const status = range ? 206 : 200
  if (request.method === 'HEAD') return new Response(null, { status, headers })

  const stream = range
    ? createReadStream(absPath, { start: range.start, end: range.end })
    : createReadStream(absPath)

  return new Response(Readable.toWeb(stream) as ReadableStream, { status, headers })
}

function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || size === 0) return null

  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) return null

  if (!rawStart) {
    const suffix = Number(rawEnd)
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }

  const start = Number(rawStart)
  const end = rawEnd ? Number(rawEnd) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null
  if (start >= size || start > end) return null

  return { start, end: Math.min(end, size - 1) }
}

/** Weak comparison against a comma-separated If-None-Match list. */
function isNotModified(header: string | null, etag: string): boolean {
  if (!header) return false
  if (header.trim() === '*') return true
  const opaque = etag.replace(/^W\//, '')
  return header.split(',').some((tag) => tag.trim().replace(/^W\//, '') === opaque)
}

function sanitizeName(name: string): string {
  return name.replace(/["\r\n\\/]/g, '_')
}

function notFound(): Response {
  return new Response('Not found', { status: 404 })
}
