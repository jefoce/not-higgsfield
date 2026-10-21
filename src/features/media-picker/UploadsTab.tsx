'use client'

import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { extensionAllowed } from '@/core/media-kinds'
import type { MediaKind, UploadItem } from '@/core/types'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { Spinner } from '@/ui/Spinner'
import { getPlatform } from '@/lib/platform'
import { errorMessage } from '@/lib/errors'
import { deleteUpload, fetchUploads } from './api'
import { openPreview, type PreviewActions } from '@/features/preview/preview-store'
import { MediaTile } from './MediaTile'
import type { PickerExtensions } from './store'
import { UploadProgressTile } from './UploadProgressTile'
import type { UploadProgressItem } from './UploadProgressTile'
import { UploadTile } from './UploadTile'

export interface UploadsTabProps {
  kinds: MediaKind[]
  max: number
  extensions?: PickerExtensions
  selected: UploadItem[]
  onSelect: (item: UploadItem) => void
  onUploaded: (items: UploadItem[]) => void
  onDeleted?: (id: string) => void
  uploading?: UploadProgressItem[]
  onRetry?: (id: string) => void
  onDismiss?: (id: string) => void
}

interface ChooseDiskTileProps {
  kinds: MediaKind[]
  max: number
  extensions?: PickerExtensions
  onUploaded: (items: UploadItem[]) => void
}

function ChooseDiskTile(props: ChooseDiskTileProps) {
  const { kinds, max, extensions, onUploaded } = props
  const [busy, setBusy] = useState(false)

  const pick = async () => {
    setBusy(true)
    try {
      const items = await (await getPlatform()).chooseFiles({ kinds, multiple: max > 1, extensions })
      if (!items.length) return
      onUploaded(items)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void pick()}
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-divider bg-white/[0.02] text-xs font-medium text-fg-2 transition hover:bg-white/[0.04] disabled:opacity-60"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
        {busy ? <Spinner size={16} /> : <FolderOpen className="h-5 w-5" aria-hidden />}
      </span>
      <span>{busy ? 'Choosing...' : 'Choose from disk'}</span>
    </button>
  )
}

const SKELETON = [0, 1, 2, 3]

/** Uploads grid with the upload tile first. */
export function UploadsTab(props: UploadsTabProps) {
  const {
    kinds,
    max,
    extensions,
    selected,
    onSelect,
    onUploaded,
    onDeleted,
    uploading = [],
    onRetry,
    onDismiss,
  } = props
  const { data, isLoading, mutate } = useSWR(['uploads', kinds], () => fetchUploads({ kinds }))
  const { data: canChooseFiles } = useSWR('platform-choose', async () =>
    (await getPlatform()).canChooseFiles(),
  )
  const [pending, setPending] = useState<UploadItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const items = (data ?? []).filter((item) =>
    extensionAllowed({ kind: item.kind, ext: item.ext, extensions }),
  )
  const selectedIds = selected.map((item) => item.id)
  const atMax = selected.length >= max
  const actions: PreviewActions = {
    select: (item: UploadItem) => onSelect(item),
    deselect: (item: UploadItem) => onSelect(item),
    available: (item: UploadItem) => {
      if (selectedIds.includes(item.id)) return ['deselect']
      if (atMax) return []
      return ['select']
    },
  }

  const handleDelete = async () => {
    if (!pending) return
    setDeleting(true)
    try {
      await deleteUpload(pending.id)
      await mutate()
      onDeleted?.(pending.id)
      toast.success('Upload deleted')
      setPending(null)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const grid = isLoading
    ? SKELETON.map((key) => (
        <div key={key} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
      ))
    : items.map((item, previewIndex) => {
        const index = selectedIds.indexOf(item.id)
        const disabled = index < 0 && atMax
        const stamp = new Date(item.createdAt).getTime()
        const version = Number.isNaN(stamp) ? item.id : stamp
        const onPreview = item.missing
          ? undefined
          : () => openPreview({ items, index: previewIndex, actions })
        const selectIndex = index >= 0 ? index : undefined
        return (
          <MediaTile
            key={item.id}
            item={item}
            mediaRef={`uploads/${item.id}`}
            thumbVersion={version}
            selected={index >= 0}
            selectIndex={selectIndex}
            disabled={disabled}
            missing={item.missing}
            onDelete={() => setPending(item)}
            onSelect={() => onSelect(item)}
            onPreview={onPreview}
          />
        )
      })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4 text-sm font-medium text-fg-2">
        Uploads
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 content-start gap-3 p-3">
          {uploading.map((entry) => {
            const retry = onRetry ? () => onRetry(entry.id) : undefined
            const dismiss = onDismiss ? () => onDismiss(entry.id) : undefined
            return (
              <UploadProgressTile key={entry.id} item={entry} onRetry={retry} onDismiss={dismiss} />
            )
          })}
          {canChooseFiles ? (
            <ChooseDiskTile kinds={kinds} max={max} extensions={extensions} onUploaded={onUploaded} />
          ) : (
            <UploadTile kinds={kinds} max={max} extensions={extensions} onUploaded={onUploaded} />
          )}
          {grid}
          {!isLoading && items.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-fg-2">No uploads yet</p>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        label="Delete upload?"
        className="w-[min(360px,90vw)] p-5"
      >
        <h2 className="text-sm font-semibold text-fg">Delete upload?</h2>
        <p className="mt-1 text-sm text-fg-2">
          Removes the app copy. Linked files keep the original on disk.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" loading={deleting} onClick={() => void handleDelete()}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
