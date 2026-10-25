import type { MediaKind } from '@/core/media-types'

export interface ChooseFilesOptions {
  kinds: MediaKind[]
  multiple: boolean
  prompt: string
}

export interface ChooseFolderOptions {
  prompt: string
}

export interface SystemAdapter {
  canChooseFiles(): Promise<boolean>
  chooseFiles(opts: ChooseFilesOptions): Promise<string[]>
  chooseFolder(opts: ChooseFolderOptions): Promise<string | null>
  reveal(path: string): Promise<void>
}
