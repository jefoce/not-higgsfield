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

import { DeleteUploadDialog } from './DeleteUploadDialog'
import type { UploadProgressItem } from './UploadProgressTile'
import { UploadsGrid } from './UploadsGrid'
import { useDeleteUpload } from './use-delete-upload'

export interface UploadsTabProps {
  kinds: MediaKind[]
  max: number
  extensions?: KindExtensions
  selected: UploadItem[]
  onSelect: (item: UploadItem) => void
  onUploaded: (items: UploadItem[]) => void
  onDeleted?: (id: string) => void
  uploading?: UploadProgressItem[]
  onRetry?: (id: string) => void
  onDismiss?: (id: string) => void
}

/** Uploads grid host with selection and delete confirmation. */
export function UploadsTab(props: UploadsTabProps) {
  const { kinds, max, extensions, selected, uploading = [] } = props

  const { data, isLoading, mutate } = useSWR(['uploads', kinds], () => {
    return fetchUploads({ kinds })
  })

  const { data: canChooseFiles } = useSWR('platform-choose', async () => {
    return (await getPlatform()).canChooseFiles()
  })

  const items = (data ?? []).filter((item) => {
    return extensionAllowed({ kind: item.kind, ext: item.ext, extensions })
  })

  const selectedIds = selected.map((item) => {
    return item.id
  })

  const isMaxReached = selected.length >= max
  const selectedIdsRef = useLatest(selectedIds)
  const isMaxReachedRef = useLatest(isMaxReached)

  const handleIsSelected = (item: UploadItem): boolean => {
    return selectedIdsRef.current.includes(item.id)
  }

  const handleAvailable = (item: UploadItem): ActionKey[] => {
    if (handleIsSelected(item)) {
      return ['deselect']
    }

    if (isMaxReachedRef.current) {
      return []
    }

    return ['select']
  }

  const handleSelect = (item: UploadItem): boolean => {
    props.onSelect(item)

    return max > 1
  }

  const actions: PreviewActions = {
    select: handleSelect,
    deselect: handleSelect,
    available: handleAvailable,
    isSelected: handleIsSelected,
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
        selectedIds={selectedIds}
        isMaxReached={isMaxReached}
        isLoading={isLoading}
        canChooseFiles={canChooseFiles === true}
        kinds={kinds}
        max={max}
        extensions={extensions}
        actions={actions}
        onUploaded={props.onUploaded}
        onRetry={props.onRetry}
        onDismiss={props.onDismiss}
        onSelect={props.onSelect}
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
