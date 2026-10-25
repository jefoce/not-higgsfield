'use client'

import { useEffect, useState } from 'react'
import { isNil } from 'lodash-es'
import useSWR from 'swr'

import type { UploadItem } from '@/core/schemas/upload-item'
import { fetchFolders } from '@/lib/api/folders'
import { pauseAudio } from '@/lib/audio-player'

import { AddFolderDialog } from '../folders/AddFolderDialog'
import { useFolderBrowse } from '../folders/use-folder-browse'
import { PickerContent } from './PickerContent'
import { PickerDropOverlay } from './PickerDropOverlay'
import { PickerFooter } from './PickerFooter'
import { PickerTabs } from './PickerTabs'
import { closeMediaPicker, type PickerRequest } from './store'
import { usePickerConfirm } from './use-picker-confirm'
import { usePickerFolders } from './use-picker-folders'
import { usePickerSelection } from './use-picker-selection'
import { usePickerUpload } from './use-picker-upload'

interface PickerBodyProps {
  request: PickerRequest
}

/** Picker contents, remounted per request so state starts fresh. */
export function PickerBody(props: PickerBodyProps) {
  const { request } = props
  const [activeTab, setActiveTab] = useState('uploads')
  const folderBrowse = useFolderBrowse(request.max)

  const { folderSub, selectedFolderRels, handleReset, handleNavigate, handleToggleFile } =
    folderBrowse

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    handleReset()
  }

  const selection = usePickerSelection(request)
  const { commit, confirm } = selection
  const { data: folders = [] } = useSWR(['folders'], fetchFolders)

  const foldersState = usePickerFolders({
    activeTab,
    folders,
    onTabChange: handleTabChange,
    onCommit: commit,
  })

  const upload = usePickerUpload({ request, onCommit: commit })
  const [isAddOpen, setIsAddOpen] = useState(false)

  const handleAddFolderOpen = () => setIsAddOpen(true)

  const handleSelectUpload = (item: UploadItem) => commit([item])

  const activeFolder = foldersState.activeFolder
  const isFolderTab = !isNil(activeFolder) && activeTab !== 'uploads'

  const { isAddingFolderFiles, handleConfirm } = usePickerConfirm({
    request,
    activeFolder,
    activeTab,
    selectedFolderRels,
    onConfirmUploads: confirm,
  })

  useEffect(() => () => pauseAudio(), [])

  const selectedCount = isFolderTab ? selectedFolderRels.length : selection.selected.length

  return (
    <>
      <div className="relative flex h-full min-h-0 flex-col" {...upload.dropProps}>
        <PickerTabs
          folders={folders}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onAddFolder={handleAddFolderOpen}
          onClose={closeMediaPicker}
          onDisconnectFolder={foldersState.handleDisconnect}
        />

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface">
          <PickerContent
            request={request}
            activeTab={activeTab}
            activeFolder={activeFolder}
            selection={selection}
            foldersState={foldersState}
            upload={upload}
            folderSub={folderSub}
            selectedFolderRels={selectedFolderRels}
            onSelectUpload={handleSelectUpload}
            onFolderNavigate={handleNavigate}
            onToggleFolderFile={handleToggleFile}
          />
        </div>

        <PickerFooter
          max={request.max}
          selectedCount={selectedCount}
          isBusy={foldersState.isBusy || isAddingFolderFiles}
          onConfirm={handleConfirm}
        />

        <PickerDropOverlay isDragging={upload.isDragging} />
      </div>

      <AddFolderDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onAdded={foldersState.handleAdded}
      />
    </>
  )
}
