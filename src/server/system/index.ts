import 'server-only'

import type { MediaKind } from '@/core/media-types'

import { HttpError } from '../errors'
import { globalState } from '../global-state'
import { darwin } from './darwin'
import { linux } from './linux'
import { win32 } from './win32'

interface ChooseFilesOptions {
  kinds: MediaKind[]
  multiple: boolean
  prompt: string
}

interface ChooseFolderOptions {
  prompt: string
}

export interface SystemAdapter {
  canChooseFiles(): Promise<boolean>
  chooseFiles(opts: ChooseFilesOptions): Promise<string[]>
  chooseFolder(opts: ChooseFolderOptions): Promise<string | null>
  reveal(path: string): Promise<void>
}

class DialogBusyError extends HttpError {
  constructor() {
    super(409, 'A dialog is already open')
    this.name = 'DialogBusyError'
  }
}

const ADAPTERS: Record<string, SystemAdapter> = { darwin, win32, linux }
const dialog = globalState('dialog', () => ({ open: false }))

/** Returns the adapter for this OS, or the Linux fallback. */
export function getSystem(): SystemAdapter {
  const adapter = ADAPTERS[process.platform] ?? linux

  return {
    canChooseFiles: () => adapter.canChooseFiles(),
    chooseFiles: (opts) => withDialog(() => adapter.chooseFiles(opts)),
    chooseFolder: (opts) => withDialog(() => adapter.chooseFolder(opts)),
    reveal: (path) => adapter.reveal(path),
  }
}

/** Serializes dialogs and maps killed commands to a timeout response. */
async function withDialog<T>(task: () => Promise<T>): Promise<T> {
  if (dialog.open) {
    throw new DialogBusyError()
  }

  dialog.open = true

  try {
    return await task()
  } catch (error) {
    if (isTimeout(error)) {
      throw new HttpError(504, 'Dialog timed out')
    }

    throw error
  } finally {
    dialog.open = false
  }
}

interface CommandTimeoutError {
  killed?: boolean
  code?: string
}

function isTimeout(error: unknown): boolean {
  const err = error as CommandTimeoutError

  return err.killed === true || err.code === 'ETIMEDOUT'
}
