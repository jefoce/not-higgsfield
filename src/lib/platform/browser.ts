import { DOWNLOAD_STAGGER_MS } from '@/core/constants'
import type { FolderItem, GenerationRecord, UploadItem } from '@/core/types'
import {
  chooseFiles as chooseFilesFromServer,
  chooseFolder as chooseFolderFromServer,
  fetchSystemCapabilities,
} from '@/features/media-picker/api'
import type { Platform } from './types'

/** Download URL built from the record alone, no history feature import. */
function downloadUrl(record: GenerationRecord): string {
  const file = record.output?.video ?? `${record.id}.mp4`
  return `/api/media/downloads/${file}?download=1`
}

/** One anchor click, used by single and batch downloads. */
function clickDownload(url: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = ''
  anchor.click()
}

export const browserPlatform: Platform = {
  kind: 'browser',

  canChooseFiles: async () => (await fetchSystemCapabilities()).chooseFiles,

  chooseFiles: ({ kinds, multiple }): Promise<UploadItem[]> =>
    chooseFilesFromServer(kinds, multiple),

  chooseFolder: (): Promise<FolderItem | null> => chooseFolderFromServer(),

  requestNotifications: async () => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'default') return
    await Notification.requestPermission().catch(() => undefined)
  },

  notify: async (title: string, body: string) => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    new Notification(title, { body })
  },

  openExternal: async (url: string) => {
    window.open(url, '_blank', 'noopener')
  },

  confirm: async (message: string) => window.confirm(message),

  saveVideo: async (record: GenerationRecord) => {
    clickDownload(downloadUrl(record))
    return true
  },

  saveVideos: async (records: GenerationRecord[]) => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    for (const [index, record] of records.entries()) {
      if (index > 0) await wait(DOWNLOAD_STAGGER_MS)
      clickDownload(downloadUrl(record))
    }
    return { saved: records.length }
  },

  onFileDrop: async () => () => undefined,
}
