import type { Platform } from './types'

let instance: Promise<Platform> | null = null

export const isDesktop = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Desktop module is loaded only inside the app, so the browser bundle never contains Tauri code. */
export function getPlatform(): Promise<Platform> {
  instance ??= isDesktop()
    ? import('./desktop').then((module) => module.desktopPlatform)
    : import('./browser').then((module) => module.browserPlatform)
  return instance
}

const impl = (): Promise<Platform> => getPlatform()

/** Same methods as `Platform`, resolving the implementation per call. */
export const platform = {
  canChooseFiles: async () => (await impl()).canChooseFiles(),
  chooseFiles: async (...args: Parameters<Platform['chooseFiles']>) => (await impl()).chooseFiles(...args),
  chooseFolder: async () => (await impl()).chooseFolder(),
  requestNotifications: async () => (await impl()).requestNotifications(),
  notify: async (...args: Parameters<Platform['notify']>) => (await impl()).notify(...args),
  openExternal: async (...args: Parameters<Platform['openExternal']>) => (await impl()).openExternal(...args),
  confirm: async (...args: Parameters<Platform['confirm']>) => (await impl()).confirm(...args),
  saveVideo: async (...args: Parameters<Platform['saveVideo']>) => (await impl()).saveVideo(...args),
  saveVideos: async (...args: Parameters<Platform['saveVideos']>) => (await impl()).saveVideos(...args),
}

export type { Platform } from './types'
