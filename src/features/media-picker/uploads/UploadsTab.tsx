'use client'

import { isNil } from 'lodash-es'
import useSWR from 'swr'

import { extensionAllowed, type KindExtensions } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'
import type { ActionKey, PreviewActions } from '@/features/preview/preview-store'
import { fetchUploads } from '@/lib/api/uploads'
import { getPlatform } from '@/lib/platform'
import { useLatest } from '@/lib/use-latest'

import { closeMediaPicker, type PickerMode } from '../picker/store'
import { DeleteUploadDialog } from './DeleteUploadDialog'
import type { UploadProgressItem } from './UploadProgressTile'
import { UploadsGrid } from './UploadsGrid'
import { useDeleteUpload } from './use-delete-upload'

export interface UploadsTabProps {
  kinds: MediaKind[]
  extensions?: KindExtensions
  mode: PickerMode
  onUploaded: (items: UploadItem[]) => void
  onDeleted?: (id: string) => void
  uploading?: UploadProgressItem[]
  onRetry?: (id: string) => void
  onDismiss?: (id: string) => void
}

/** Pick mode has no local selection, toggle mode supplies its own ids. */
function useNoSelectedIds(): string[] {
  return []
}

function isUploadSelected(item: UploadItem, selectedIds: string[]): boolean {
  return selectedIds.includes(item.id)
}

interface UploadActionParams {
  mode: PickerMode
  item: UploadItem
  selectedIds: string[]
}

function uploadDisabledReason(params: UploadActionParams): string | undefined {
  const { mode, item, selectedIds } = params

  if (mode.kind !== 'toggle' || isUploadSelected(item, selectedIds)) {
    return undefined
  }

  return mode.canAdd(item) ?? undefined
}

function uploadAvailableActions(params: UploadActionParams): ActionKey[] {
  const { mode, item, selectedIds } = params

  if (mode.kind !== 'toggle') {
    return []
  }

  if (isUploadSelected(item, selectedIds)) {
    return ['deselect']
  }

  if (!isNil(mode.canAdd(item))) {
    return []
  }

  return ['select']
}

function toggleFromPreview(mode: PickerMode, item: UploadItem): boolean {
  if (mode.kind !== 'toggle') {
    return false
  }

  mode.onToggle(item)

  return true
}

/** Uploads grid host with mode-driven selection and delete confirmation. */
export function UploadsTab(props: UploadsTabProps) {
  const { kinds, extensions, mode, uploading = [] } = props

  const { data, isLoading, mutate } = useSWR(['uploads', kinds], () => {
    return fetchUploads({ kinds })
  })

  const { data: canChooseFiles } = useSWR('platform-choose', async () => {
    return (await getPlatform()).canChooseFiles()
  })

  const items = (data ?? []).filter((item) => {
    return extensionAllowed({ kind: item.kind, ext: item.ext, extensions })
  })

  // Mode is fixed for the mount, so the hook choice stays stable.
  const useSelectedIds = mode.kind === 'toggle' ? mode.useSelectedIds : useNoSelectedIds
  const selectedIds = useSelectedIds()
  const selectedIdsRef = useLatest(selectedIds)
  // Upload tiles only compare max with 1 to enable multiple files.
  const uploadMax = mode.kind === 'toggle' ? 2 : 1

  const handleIsSelected = (item: UploadItem): boolean => {
    return isUploadSelected(item, selectedIds)
  }

  const handlePreviewSelected = (item: UploadItem): boolean => {
    return isUploadSelected(item, selectedIdsRef.current)
  }

  const handleDisabledReason = (item: UploadItem): string | undefined => {
    return uploadDisabledReason({ mode, item, selectedIds })
  }

  const handleAvailable = (item: UploadItem): ActionKey[] => {
    return uploadAvailableActions({ mode, item, selectedIds: selectedIdsRef.current })
  }

  const handleTogglePreview = (item: UploadItem): boolean => {
    return toggleFromPreview(mode, item)
  }

  const handleSelect = (item: UploadItem): void => {
    if (mode.kind === 'toggle') {
      mode.onToggle(item)

      return
    }

    mode.onPick(item)
    closeMediaPicker()
  }

  const actions: PreviewActions = {}

  if (mode.kind === 'toggle') {
    actions.select = handleTogglePreview
    actions.deselect = handleTogglePreview
    actions.available = handleAvailable
    actions.isSelected = handlePreviewSelected
  }

  const deletion = useDeleteUpload({ mutate, onDeleted: props.onDeleted })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4 text-sm font-medium text-fg-2">
        Uploads
      </div>

      <UploadsGrid
        items={items}
        uploading={uploading}
        isLoading={isLoading}
        canChooseFiles={canChooseFiles === true}
        kinds={kinds}
        max={uploadMax}
        extensions={extensions}
        actions={actions}
        isSelected={handleIsSelected}
        disabledReason={handleDisabledReason}
        onUploaded={props.onUploaded}
        onRetry={props.onRetry}
        onDismiss={props.onDismiss}
        onSelect={handleSelect}
        onDelete={deletion.handleDeleteRequest}
      />

      <DeleteUploadDialog
        isOpen={!isNil(deletion.pending)}
        isDeleting={deletion.isDeleting}
        onOpenChange={deletion.handlePendingOpenChange}
        onCancel={deletion.handleCancelDelete}
        onConfirm={deletion.handleConfirmDelete}
      />
    </div>
  )
}
