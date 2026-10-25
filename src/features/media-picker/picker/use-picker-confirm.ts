'use client'

import { useCallback } from 'react'
import { isEmpty, isNil } from 'lodash-es'
import { toast } from 'sonner'

import { messageOf } from '@/core/errors'
import type { FolderItem } from '@/core/schemas/folder-item'
import { linkFolderFile } from '@/lib/api/uploads'
import { useAsyncAction } from '@/lib/use-async-action'

import { closeMediaPicker, type PickerRequest } from './store'

interface UsePickerConfirmParams {
  request: PickerRequest
  activeFolder?: FolderItem
  activeTab: string
  selectedFolderRels: string[]
  onConfirmUploads: () => void
}

/** Confirms uploads, or links the picked folder files before committing them. */
export function usePickerConfirm(params: UsePickerConfirmParams) {
  const { request, activeFolder, activeTab, selectedFolderRels, onConfirmUploads } = params

  const linkFolderFiles = async (folder: FolderItem): Promise<void> => {
    try {
      const rels = selectedFolderRels.slice(0, request.max)

      const uploads = await Promise.all(
        rels.map((rel) => linkFolderFile({ folderId: folder.id, relPath: rel })),
      )

      request.onPick(uploads)
      closeMediaPicker()
    } catch (error) {
      toast.error(messageOf(error))
    }
  }

  const { isRunning: isAddingFolderFiles, run } = useAsyncAction(linkFolderFiles)

  const handleConfirm = useCallback(() => {
    if (isNil(activeFolder) || activeTab === 'uploads') {
      onConfirmUploads()

      return
    }

    if (isEmpty(selectedFolderRels)) {
      return
    }

    void run(activeFolder)
  }, [activeFolder, activeTab, onConfirmUploads, run, selectedFolderRels])

  return { isAddingFolderFiles, handleConfirm }
}
