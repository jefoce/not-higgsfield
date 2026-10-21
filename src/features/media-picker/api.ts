import { THUMB_WIDTH } from '@/core/constants'
import type {
  BrowseResult,
  FolderItem,
  FolderListing,
  MediaKind,
  SystemCapabilities,
  UploadItem,
} from '@/core/types'
import { apiDelete, apiPost, fetcher } from '@/lib/fetcher'
import { canPlay } from '@/lib/media-support'

export interface FetchUploadsParams {
  kinds?: MediaKind[]
  ids?: string[]
}

function withQuery(base: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
  const qs = query.toString()
  return qs ? `${base}?${qs}` : base
}

const encodeRef = (ref: string): string => ref.split('/').map(encodeURIComponent).join('/')

export function fetchUploads(params: FetchUploadsParams = {}): Promise<UploadItem[]> {
  return fetcher<UploadItem[]>(
    withQuery('/api/uploads', {
      kind: params.kinds?.length ? params.kinds.join(',') : undefined,
      ids: params.ids?.length ? params.ids.join(',') : undefined,
    }),
  )
}

interface UploadFilesWithProgressParams {
  files: File[]
  onProgress: (sent: number, total: number) => void
  signal?: AbortSignal
}

/** OS dialog support for the current server. */
export function fetchSystemCapabilities(): Promise<SystemCapabilities> {
  return fetcher<SystemCapabilities>('/api/system/capabilities')
}

export function chooseFiles(kinds: MediaKind[], multiple: boolean): Promise<UploadItem[]> {
  return apiPost<UploadItem[]>('/api/system/choose-files', { kinds, multiple })
}

export function chooseFolder(): Promise<FolderItem | null> {
  return apiPost<FolderItem | null>('/api/system/choose-folder', {})
}

/** Multipart upload with byte progress from `XMLHttpRequest`. */
export function uploadFilesWithProgress(params: UploadFilesWithProgressParams): Promise<UploadItem[]> {
  const { files, onProgress, signal } = params
  const form = new FormData()
  for (const file of files) form.append('file', file)

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
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

function serverErrorText(xhr: XMLHttpRequest): string {
  const body = xhr.response as { error?: string } | null
  return body?.error ?? (xhr.statusText || `Upload failed (${xhr.status})`)
}

export function uploadFiles(files: File[]): Promise<UploadItem[]> {
  return uploadFilesWithProgress({ files, onProgress: () => undefined })
}

export function linkFolderFile(input: { folderId: string; relPath: string }): Promise<UploadItem> {
  return apiPost<UploadItem>('/api/uploads/link', input)
}

export function linkAbsPath(absPath: string): Promise<UploadItem> {
  return apiPost<UploadItem>('/api/uploads/link', { absPath })
}

export function deleteUpload(id: string): Promise<void> {
  return apiDelete<void>(`/api/uploads/${encodeURIComponent(id)}`)
}

export function fetchFolders(): Promise<FolderItem[]> {
  return fetcher<FolderItem[]>('/api/folders')
}

export function createFolder(path: string): Promise<FolderItem> {
  return apiPost<FolderItem>('/api/folders', { path })
}

export function deleteFolder(id: string): Promise<void> {
  return apiDelete<void>(`/api/folders/${encodeURIComponent(id)}`)
}

interface FetchFolderFilesParams {
  folderId: string
  sub?: string
  kinds?: MediaKind[]
}

export function fetchFolderFiles(params: FetchFolderFilesParams): Promise<FolderListing> {
  const { folderId, sub = '', kinds } = params
  return fetcher<FolderListing>(
    withQuery(`/api/folders/${encodeURIComponent(folderId)}/files`, {
      sub: sub || undefined,
      kind: kinds?.length ? kinds.join(',') : undefined,
    }),
  )
}

export function browseDirs(path?: string, hidden = false): Promise<BrowseResult> {
  return fetcher<BrowseResult>(
    withQuery('/api/fs/browse', { path, hidden: hidden ? '1' : undefined }),
  )
}

interface ThumbUrlParams {
  ref: string
  w?: number
  version?: string | number
}

/** Media stream URL, routed through the compat copy when the MIME cannot play. */
export function mediaUrl(ref: string, mime?: string): string {
  const [pathRef, query = ''] = ref.split('?')
  const base = `/api/media/${encodeRef(pathRef)}`
  if (!mime || canPlay(mime)) return query ? `${base}?${query}` : base

  const params = new URLSearchParams(query)
  params.set('compat', '1')
  return `${base}?${params.toString()}`
}

/** Thumbnail URL for a ref, encoding each path segment. */
export function thumbUrl(params: ThumbUrlParams): string {
  const { ref, w = THUMB_WIDTH, version } = params
  const query = new URLSearchParams({ w: String(w) })
  if (version !== undefined) query.set('v', String(version))
  return `/api/thumbs/${encodeRef(ref)}?${query.toString()}`
}
