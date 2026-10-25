'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'

import type { BrowseResult } from '@/core/media-types'
import type { FolderItem } from '@/core/schemas/folder-item'
import { createFolder } from '@/lib/api/folders'
import { toastError } from '@/lib/notify'
import { getPlatform } from '@/lib/platform'
import { useAsyncAction } from '@/lib/use-async-action'

interface UseFolderConnectParams {
  data: BrowseResult | null
  onAdded: (folder: FolderItem) => void
  onClose: () => void
}

export interface FolderConnect {
  isAdding: boolean
  isChoosing: boolean
  add: () => void
  chooseNative: () => void
}

/** Connect actions for the add-folder dialog. */
export function useFolderConnect(params: UseFolderConnectParams): FolderConnect {
  const { data, onAdded, onClose } = params

  const addFolder = async (): Promise<void> => {
    if (!data) {
      return
    }

    try {
      const folder = await createFolder(data.path)

      toast.success('Folder connected')
      onAdded(folder)
      onClose()
    } catch (error) {
      toastError(error)
    }
  }

  const chooseFolder = async (): Promise<void> => {
    try {
      const folder = await (await getPlatform()).chooseFolder()

      if (!folder) {
        return
      }

      toast.success('Folder connected')
      onAdded(folder)
      onClose()
    } catch (error) {
      toastError(error)
    }
  }

  const { isRunning: isAdding, run: runAdd } = useAsyncAction(addFolder)
  const { isRunning: isChoosing, run: runChoose } = useAsyncAction(chooseFolder)

  const add = useCallback(() => void runAdd(), [runAdd])

  const chooseNative = useCallback(() => void runChoose(), [runChoose])

  return { isAdding, isChoosing, add, chooseNative }
}
