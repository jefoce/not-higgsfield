'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import useSWR, { useSWRConfig } from 'swr'
import type { FolderItem, UploadItem } from '@/core/types'
import { Button } from '@/ui/Button'
import { pauseAudio } from '@/lib/audio-player'
import { platform } from '@/lib/platform'
import { AddFolderDialog } from './AddFolderDialog'
import { errorMessage } from '@/lib/errors'
import { deleteFolder, fetchFolders, linkFolderFile } from './api'
import { FolderTab } from './FolderTab'
import { PickerTabs } from './PickerTabs'
import { closeMediaPicker, useMediaPickerStore, type PickerRequest } from './store'
import { UploadsTab } from './UploadsTab'
import { useDropUpload } from './use-drop-upload'
import { usePasteMedia } from './use-paste-media'
import { useUploadQueue } from './use-upload-queue'

const HINT =
  'Choose from disk links files without copying. Pasted and dropped files are copied.'

interface PickerBodyProps {
  request: PickerRequest
}

/** Picker contents, remounted per request so state starts fresh. */
export function PickerBody(props: PickerBodyProps) {
  const { request } = props
  const [activeTab, setActiveTab] = useState('uploads')
  const [selected, setSelected] = useState<UploadItem[]>([])
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const { mutate } = useSWRConfig()
  const { data: folders = [] } = useSWR(['folders'], fetchFolders)

  useEffect(() => () => pauseAudio(), [])

  const commit = useCallback(
    (items: UploadItem[]) => {
      if (request !== useMediaPickerStore.getState().request) return
      const allowed = items.filter(
        (item) => !item.missing && request.kinds.includes(item.kind),
      )
      if (!allowed.length) return
      if (request.max === 1) {
        request.onPick([allowed[0]])
        closeMediaPicker()
        return
      }
      setSelected((previous) => {
        const next = [...previous]
        for (const item of allowed) {
          const index = next.findIndex((entry) => entry.id === item.id)
          if (index >= 0) {
            next.splice(index, 1)
            continue
          }
          if (next.length < request.max) next.push(item)
        }
        return next
      })
    },
    [request],
  )

  const refreshUploads = useCallback(() => {
    void mutate(
      (key) => Array.isArray(key) && key[0] === 'uploads',
      undefined,
      { revalidate: true },
    )
  }, [mutate])

  const handleUploaded = useCallback(
    (items: UploadItem[]) => {
      if (request !== useMediaPickerStore.getState().request) return
      refreshUploads()
      commit(items)
    },
    [commit, refreshUploads, request],
  )

  const queue = useUploadQueue(handleUploaded)

  const { dragging, dropProps } = useDropUpload({
    id: 'picker',
    enabled: true,
    kinds: request.kinds,
    extensions: request.extensions,
    onUploaded: handleUploaded,
    onFiles: queue.enqueue,
  })
  usePasteMedia({
    enabled: true,
    scope: 'window',
    kinds: () => request.kinds,
    extensions: () => request.extensions,
    onFiles: queue.enqueue,
    onUploaded: handleUploaded,
  })
  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === activeTab),
    [activeTab, folders],
  )

  const handleAdded = (folder: FolderItem) => {
    void mutate(['folders'])
    setActiveTab(folder.id)
  }

  const handleDisconnect = async (folderId: string) => {
    if (!(await platform.confirm('Disconnect this folder? Existing uploads stay.'))) return
    try {
      await deleteFolder(folderId)
      await mutate(['folders'])
      if (activeTab === folderId) setActiveTab('uploads')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const handlePickFile = async (folderId: string, relPath: string) => {
    setBusy(true)
    try {
      commit([await linkFolderFile({ folderId, relPath })])
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const confirmSelection = () => {
    request.onPick(selected)
    closeMediaPicker()
  }

  const content =
    activeFolder && activeTab !== 'uploads' ? (
      <FolderTab
        key={activeFolder.id}
        folderId={activeFolder.id}
        folderName={activeFolder.name}
        kinds={request.kinds}
        extensions={request.extensions}
        onPickFile={(rel) => void handlePickFile(activeFolder.id, rel)}
      />
    ) : (
      <UploadsTab
        kinds={request.kinds}
        max={request.max}
        extensions={request.extensions}
        selected={selected}
        onSelect={(item) => commit([item])}
        onUploaded={handleUploaded}
        uploading={queue.items}
        onRetry={queue.retry}
        onDismiss={queue.dismiss}
        onDeleted={(id) => setSelected((previous) => previous.filter((item) => item.id !== id))}
      />
    )

  return (
    <>
      <div className="relative flex h-full min-h-0 flex-col" {...dropProps}>
        <PickerTabs
          folders={folders}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onAddFolder={() => setAddOpen(true)}
          onClose={closeMediaPicker}
          onDisconnectFolder={(id) => void handleDisconnect(id)}
        />

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface">
          {content}
        </div>

        <div className="mt-3 flex shrink-0 items-center justify-between gap-3 px-3 py-2">
          <p className="text-xs text-fg-2">{HINT}</p>
          {request.max > 1 && (
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-fg-2">{selected.length} selected</span>
              <Button
                size="sm"
                variant="primary"
                disabled={selected.length === 0}
                loading={busy}
                onClick={confirmSelection}
              >
                Add
              </Button>
            </div>
          )}
        </div>

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-lime bg-black/60 text-sm font-medium text-lime backdrop-blur-sm">
            Drop to upload
          </div>
        )}
      </div>

      <AddFolderDialog open={addOpen} onOpenChange={setAddOpen} onAdded={handleAdded} />
    </>
  )
}
