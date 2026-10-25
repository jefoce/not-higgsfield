import { isEmpty, isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import type { MediaKind } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'
import { apiDelete, apiPost, fetcher } from '@/lib/fetcher'

export interface FetchUploadsParams {
  kinds?: MediaKind[]
  ids?: string[]
}

/** Adds only defined, non-empty query values to a URL. */
export function withQuery(base: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (isNonEmptyString(value)) {
      query.set(key, value)
    }
  }

  const qs = query.toString()

  if (isEmpty(qs)) {
    return base
  }

  return `${base}?${qs}`
}

export function fetchUploads(params: FetchUploadsParams = {}): Promise<UploadItem[]> {
  let kindQuery: string | undefined
  let idsQuery: string | undefined

  if (!isNil(params.kinds) && params.kinds.length > 0) {
    kindQuery = params.kinds.join(',')
  }

  if (!isNil(params.ids) && params.ids.length > 0) {
    idsQuery = params.ids.join(',')
  }

  return fetcher<UploadItem[]>(
    withQuery('/api/uploads', {
      kind: kindQuery,
      ids: idsQuery,
    }),
  )
}

interface UploadFilesWithProgressParams {
  files: File[]
  onProgress: (sent: number, total: number) => void
  signal?: AbortSignal
}

/** Multipart upload with byte progress from `XMLHttpRequest`. */
export function uploadFilesWithProgress(
  params: UploadFilesWithProgressParams,
): Promise<UploadItem[]> {
  const { files, onProgress, signal } = params
  const form = new FormData()

  for (const file of files) {
    form.append('file', file)
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new DOMException('Upload cancelled', 'AbortError'))

      return
    }

    const xhr = new XMLHttpRequest()

    xhr.open('POST', '/api/uploads')
    xhr.responseType = 'json'
    xhr.upload.onprogress = (event) => onProgress(event.loaded, event.total)

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((xhr.response ?? []) as UploadItem[])

        return
      }

      reject(new Error(serverErrorText(xhr)))
    }

    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(form)
  })
}

interface UploadErrorBody {
  error?: string
}

function serverErrorText(xhr: XMLHttpRequest): string {
  const body = xhr.response as UploadErrorBody | null
  const isText = isEmpty(xhr.statusText)

  const text = isText ? `Upload failed (${xhr.status})` : xhr.statusText

  return body?.error ?? text
}

export function uploadFiles(files: File[]): Promise<UploadItem[]> {
  return uploadFilesWithProgress({ files, onProgress: () => {} })
}

interface LinkFolderFileParams {
  folderId: string
  relPath: string
}

export function linkFolderFile(params: LinkFolderFileParams): Promise<UploadItem> {
  const { folderId, relPath } = params

  return apiPost<UploadItem>('/api/uploads/link', { folderId, relPath })
}

interface LinkGenerationFileParams {
  generationId: string
}

export function linkGenerationFile(params: LinkGenerationFileParams): Promise<UploadItem> {
  const { generationId } = params

  return apiPost<UploadItem>('/api/uploads/link', { generationId })
}

export function linkAbsPath(absPath: string): Promise<UploadItem> {
  return apiPost<UploadItem>('/api/uploads/link', { absPath })
}

export function deleteUpload(id: string): Promise<void> {
  return apiDelete<void>(`/api/uploads/${encodeURIComponent(id)}`)
}
