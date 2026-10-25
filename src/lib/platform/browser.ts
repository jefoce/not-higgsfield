import { DOWNLOAD_STAGGER_MS } from '@/core/constants'
import type { FolderItem } from '@/core/schemas/folder-item'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import { downloadMediaUrl } from '@/lib/api/media-urls'
import {
  chooseFiles as chooseFilesFromServer,
  chooseFolder as chooseFolderFromServer,
  fetchSystemCapabilities,
} from '@/lib/api/system'

import type { Platform } from './types'

/** Download URL built from the record alone, no history feature import. */
function downloadUrl(record: GenerationRecord): string {
  const file = record.output?.video ?? `${record.id}.mp4`

  return downloadMediaUrl(file, true)
}

/** One anchor click, used by single and batch downloads. */
function clickDownload(url: string): void {
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = ''
  anchor.click()
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

const noop = (): void => {}

async function noFileDrop(): Promise<() => void> {
  return noop
}

export const browserPlatform: Platform = {
  kind: 'browser',

  canChooseFiles: async () => {
    return (await fetchSystemCapabilities()).chooseFiles
  },

  chooseFiles: ({ kinds, multiple: isMultiple }): Promise<UploadItem[]> => {
    return chooseFilesFromServer(kinds, isMultiple)
  },

  chooseFolder: (): Promise<FolderItem | null> => {
    return chooseFolderFromServer()
  },

  requestNotifications: async () => {
    if (typeof Notification === 'undefined') {
      return
    }

    if (Notification.permission !== 'default') {
      return
    }

    await Notification.requestPermission().catch(() => {})
  },

  notify: async (title: string, body: string) => {
    if (typeof Notification === 'undefined') {
      return
    }

    if (Notification.permission !== 'granted') {
      return
    }

    new Notification(title, { body })
  },

  openExternal: async (url: string) => {
    window.open(url, '_blank', 'noopener')
  },

  confirm: async (message: string) => {
    return window.confirm(message)
  },

  saveVideo: async (record: GenerationRecord) => {
    clickDownload(downloadUrl(record))

    return true
  },

  saveVideos: async (records: GenerationRecord[]) => {
    for (const [index, record] of records.entries()) {
      if (index > 0) {
        await wait(DOWNLOAD_STAGGER_MS)
      }

      clickDownload(downloadUrl(record))
    }

    return { saved: records.length }
  },

  onFileDrop: noFileDrop,
}
