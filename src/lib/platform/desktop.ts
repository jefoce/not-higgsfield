import { ask, open, save } from '@tauri-apps/plugin-dialog'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { chunk } from 'lodash-es'
import { HISTORY_BATCH_MAX } from '@/core/constants'
import { promptSlug } from '@/core/file-names'
import { extensionsForKinds } from '@/core/media-kinds'
import type { FolderItem, GenerationRecord, UploadItem } from '@/core/types'
import { apiPost } from '@/lib/fetcher'
import type { Platform } from './types'
import { linkPaths } from './link-paths'

export const desktopPlatform: Platform = {
  kind: 'desktop',

  canChooseFiles: async () => true,

  chooseFiles: async (params): Promise<UploadItem[]> => {
    const { kinds, multiple, extensions } = params
    const selected = await open({
      multiple,
      filters: [{ name: 'Media', extensions: extensionsForKinds(kinds, extensions) }],
    })
    if (!selected) return []
    return linkPaths(Array.isArray(selected) ? selected : [selected])
  },

  chooseFolder: async (): Promise<FolderItem | null> => {
    const selected = await open({ directory: true, multiple: false })
    if (!selected || Array.isArray(selected)) return null
    return apiPost<FolderItem>('/api/folders', { path: selected })
  },

  requestNotifications: async () => {
    if (await isPermissionGranted()) return
    await requestPermission()
  },

  notify: async (title: string, body: string) => {
    if (!(await isPermissionGranted())) return
    sendNotification({ title, body })
  },

  openExternal: async (url: string) => {
    await openUrl(url)
  },

  confirm: async (message: string) =>
    ask(message, { title: 'Not Higgsfield', kind: 'warning' }),

  saveVideo: async (record: GenerationRecord) => {
    const target = await save({
      defaultPath: `${promptSlug(record)}.mp4`,
      filters: [{ name: 'Video', extensions: ['mp4'] }],
    })
    if (!target) return false
    await apiPost(`/api/generations/${record.id}/export`, { path: target, overwrite: true })
    return true
  },

  saveVideos: async (records: GenerationRecord[]) => {
    const count = records.length
    const dir = await open({
      directory: true,
      multiple: false,
      title: `Choose a folder for ${count} video${count === 1 ? '' : 's'}`,
    })
    if (!dir || Array.isArray(dir)) return { saved: 0 }
    let saved = 0
    for (const part of chunk(records, HISTORY_BATCH_MAX)) {
      const result = await apiPost<{ saved: string[] }>('/api/generations/export-batch', {
        ids: part.map((record) => record.id),
        dir,
      })
      saved += result.saved.length
    }
    return { saved, folder: dir }
  },

  onFileDrop: async (handler) => {
    return getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload
      if (payload.type === 'leave') {
        handler({ type: 'leave' })
        return
      }
      const ratio = window.devicePixelRatio || 1
      const x = payload.position.x / ratio
      const y = payload.position.y / ratio
      if (payload.type === 'drop') handler({ type: 'drop', x, y, paths: payload.paths })
      else handler({ type: 'over', x, y })
    })
  },
}
