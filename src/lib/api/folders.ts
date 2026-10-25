import { isEmpty, isNil } from 'lodash-es'

import type { BrowseResult, FolderItem, FolderListing, MediaKind } from '@/core/media-types'
import { apiDelete, apiPost, fetcher } from '@/lib/fetcher'

import { withQuery } from './uploads'

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
      sub: isEmpty(sub) ? undefined : sub,
      kind: isNil(kinds) || kinds.length === 0 ? undefined : kinds.join(','),
    }),
  )
}

export function browseDirs(path?: string, isHidden = false): Promise<BrowseResult> {
  return fetcher<BrowseResult>(
    withQuery('/api/fs/browse', { path, hidden: isHidden ? '1' : undefined }),
  )
}
