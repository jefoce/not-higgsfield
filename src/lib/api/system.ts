import type { FolderItem, MediaKind, UploadItem } from '@/core/media-types'
import type { SystemCapabilities } from '@/core/types'
import { apiPost, fetcher } from '@/lib/fetcher'

/** OS dialog support for the current server. */
export function fetchSystemCapabilities(): Promise<SystemCapabilities> {
  return fetcher<SystemCapabilities>('/api/system/capabilities')
}

export function chooseFiles(kinds: MediaKind[], isMultiple: boolean): Promise<UploadItem[]> {
  return apiPost<UploadItem[]>('/api/system/choose-files', { kinds, multiple: isMultiple })
}

export function chooseFolder(): Promise<FolderItem | null> {
  return apiPost<FolderItem | null>('/api/system/choose-folder', {})
}
