import type { KindExtensions } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { FolderItem } from '@/core/schemas/folder-item'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'

export interface ChooseFilesParams {
  kinds: MediaKind[]
  multiple: boolean
  extensions?: KindExtensions
}

export interface SavedVideos {
  saved: number
  folder?: string
}

export interface AppInfo {
  version: string
  installKind: InstallKind
  autoCheck: boolean
  lastCheck: string | null
}

export interface AppUpdate {
  version: string
  notes: string
  date: string | null
}

export const UPDATE_PHASES = ['downloading', 'installing'] as const

type UpdatePhase = (typeof UPDATE_PHASES)[number]

export interface UpdateProgress {
  downloaded: number
  total: number | null
  phase: UpdatePhase
}

export interface InstallResult {
  cancelled: boolean
}

export const INSTALL_KINDS = ['macos', 'windows', 'appimage', 'linux-package', 'browser'] as const

type InstallKind = (typeof INSTALL_KINDS)[number]

export type UpdateListener = (progress: UpdateProgress) => void

export interface Platform {
  kind: 'browser' | 'desktop'

  /** Native file dialog, true when choose* works. */
  canChooseFiles(): Promise<boolean>
  chooseFiles(params: ChooseFilesParams): Promise<UploadItem[]>
  chooseFolder(): Promise<FolderItem | null>

  /** Ask once, on the first Generate. */
  requestNotifications(): Promise<void>
  notify(title: string, body: string): Promise<void>
  openExternal(url: string): Promise<void>

  /** Native confirm dialog, false when dismissed. */
  confirm(message: string): Promise<boolean>

  /** Saves a finished video where the user picks, false when the dialog is cancelled. */
  saveVideo(record: GenerationRecord): Promise<boolean>

  /** Saves many videos into one folder. Browser starts a staggered download per file. */
  saveVideos(records: GenerationRecord[]): Promise<SavedVideos>

  /** Desktop only: real paths of files dropped on the window. Browser returns a no-op unsubscribe. */
  onFileDrop(handler: FileDropHandler): Promise<() => void>

  appInfo(): Promise<AppInfo>
  checkUpdate(): Promise<AppUpdate | null>
  installUpdate(onProgress: UpdateListener): Promise<InstallResult>
  setAutoCheck(isOn: boolean): Promise<void>
  openReleasePage(): Promise<void>
}

interface FileDropOverEvent {
  type: 'over'
  x: number
  y: number
}

interface FileDropDropEvent {
  type: 'drop'
  x: number
  y: number
  paths: string[]
}

interface FileDropLeaveEvent {
  type: 'leave'
}

type FileDropEvent = FileDropOverEvent | FileDropDropEvent | FileDropLeaveEvent

type FileDropHandler = (event: FileDropEvent) => void
