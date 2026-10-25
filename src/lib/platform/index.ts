import { isNil } from 'lodash-es'

import type { FolderItem } from '@/core/schemas/folder-item'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'

import type { ChooseFilesParams, Platform, SavedVideos } from './types'

let instance: Promise<Platform> | null = null

export const isDesktop = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Desktop module is loaded only inside the app, so the browser bundle never contains Tauri code. */
export function getPlatform(): Promise<Platform> {
  if (isNil(instance)) {
    if (isDesktop()) {
      instance = import('./desktop').then((module) => module.desktopPlatform)
    } else {
      instance = import('./browser').then((module) => module.browserPlatform)
    }
  }

  return instance
}

const impl = (): Promise<Platform> => getPlatform()

/** Same methods as `Platform`, resolving the implementation per call. */
export const platform = {
  canChooseFiles: async (): Promise<boolean> => (await impl()).canChooseFiles(),
  chooseFiles: async (params: ChooseFilesParams): Promise<UploadItem[]> =>
    (await impl()).chooseFiles(params),
  chooseFolder: async (): Promise<FolderItem | null> => (await impl()).chooseFolder(),
  requestNotifications: async (): Promise<void> => (await impl()).requestNotifications(),
  notify: async (title: string, body: string): Promise<void> => (await impl()).notify(title, body),
  openExternal: async (url: string): Promise<void> => (await impl()).openExternal(url),
  confirm: async (message: string): Promise<boolean> => (await impl()).confirm(message),
  saveVideo: async (record: GenerationRecord): Promise<boolean> => (await impl()).saveVideo(record),
  saveVideos: async (records: GenerationRecord[]): Promise<SavedVideos> =>
    (await impl()).saveVideos(records),
}
