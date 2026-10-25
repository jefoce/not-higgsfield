'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useSWRConfig } from 'swr'

import { messageOf } from '@/core/errors'
import type { FolderItem } from '@/core/schemas/folder-item'
import type { UploadItem } from '@/core/schemas/upload-item'
import { deleteFolder } from '@/lib/api/folders'
import { linkFolderFile } from '@/lib/api/uploads'
import { platform } from '@/lib/platform'
import { useAsyncAction } from '@/lib/use-async-action'

interface UsePickerFoldersParams {
  activeTab: string
  folders: FolderItem[]
  onTabChange: (tab: string) => void
  onCommit: (items: UploadItem[]) => void
}

export interface PickerFolders {
  activeFolder?: FolderItem
  isBusy: boolean
  handleAdded: (folder: FolderItem) => void
  handleDisconnect: (folderId: string) => void
  handlePickFile: (rel: string) => void
}

/** Connected-folder state and actions for the picker body. */
export function usePickerFolders(params: UsePickerFoldersParams): PickerFolders {
  const { activeTab, folders, onTabChange, onCommit } = params
  const { mutate } = useSWRConfig()
  const activeFolder = folders.find((folder) => folder.id === activeTab)

  const handleAdded = useCallback(
    (folder: FolderItem) => {
      void mutate(['folders'])
      onTabChange(folder.id)
    },
    [mutate, onTabChange],
  )

  const handleDisconnectSync = useCallback(
    async (folderId: string) => {
      if (!(await platform.confirm('Disconnect this folder? Existing uploads stay.'))) {
        return
      }

      try {
        await deleteFolder(folderId)
        await mutate(['folders'])

        if (activeTab === folderId) {
          onTabChange('uploads')
        }
      } catch (error) {
        toast.error(messageOf(error))
      }
    },
    [activeTab, mutate, onTabChange],
  )

  const handleDisconnect = useCallback(
    (folderId: string) => void handleDisconnectSync(folderId),
    [handleDisconnectSync],
  )

  const linkFile = async (folderId: string, relPath: string): Promise<void> => {
    try {
      onCommit([await linkFolderFile({ folderId, relPath })])
    } catch (error) {
      toast.error(messageOf(error))
    }
  }

  const { isRunning: isBusy, run: runLinkFile } = useAsyncAction(linkFile)

  const handlePickFile = useCallback(
    (rel: string) => {
      if (!activeFolder) {
        return
      }

      void runLinkFile(activeFolder.id, rel)
    },
    [activeFolder, runLinkFile],
  )

  return { activeFolder, isBusy, handleAdded, handleDisconnect, handlePickFile }
}
