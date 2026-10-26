'use client'

import { useState } from 'react'
import { isEmpty, isNil } from 'lodash-es'
import useSWR from 'swr'

import { isNonEmptyString } from '@/core/guards'
import { extensionAllowed, extWithDot, type KindExtensions, mimeFromExt } from '@/core/media-kinds'
import type { FolderFile, MediaKind } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'
import {
  openPreview,
  type PreviewActions,
  type PreviewItem,
} from '@/features/preview/preview-store'
import { fetchFolderFiles } from '@/lib/api/folders'
import { thumbUrl } from '@/lib/api/media-urls'
import { linkFolderFile } from '@/lib/api/uploads'
import { toastError } from '@/lib/notify'
import { useAsyncAction } from '@/lib/use-async-action'

import { closeMediaPicker, type PickerMode } from '../picker/store'
import { FolderBreadcrumbs } from './FolderBreadcrumbs'
import { FolderDirTile } from './FolderDirTile'
import { FolderFileTile } from './FolderFileTile'

export interface FolderTabProps {
  folderId: string
  folderName: string
  kinds: MediaKind[]
  extensions?: KindExtensions
  sub: string
  mode: PickerMode
  onNavigate: (sub: string) => void
}

const SKELETON = [0, 1, 2, 3, 4, 5]

interface FolderPreviewItemParams {
  folderId: string
  file: FolderFile
}

/** Preview-only item for a folder file. Nothing links until selected. */
function folderPreviewItem(params: FolderPreviewItemParams): PreviewItem {
  const { folderId, file } = params
  const ext = extWithDot(file.name)

  return {
    id: `folder:${folderId}:${file.rel}`,
    source: 'link',
    kind: file.kind,
    mime: mimeFromExt(ext) ?? '',
    ext,
    originalName: file.name,
    sizeBytes: file.sizeBytes,
    createdAt: new Date(file.mtimeMs).toISOString(),
    previewRef: `folders/${folderId}/${file.rel}`,
  }
}

/** Rel path of a folder preview item, undefined for other sources. */
function previewRel(folderId: string, item: PreviewItem): string | undefined {
  const prefix = `folders/${folderId}/`
  const ref = item.previewRef

  if (!isNonEmptyString(ref) || !ref.startsWith(prefix)) {
    return undefined
  }

  return ref.slice(prefix.length)
}

/** Applies a linked folder file through the request mode. */
function applyPicked(mode: PickerMode, upload: UploadItem): void {
  if (mode.kind === 'toggle') {
    mode.onToggle(upload)

    return
  }

  mode.onPick(upload)
  closeMediaPicker()
}

interface FolderPreviewActionsParams {
  folderId: string
  mode: PickerMode
  onLink: (rel: string) => void
}

/** Preview actions link the shown file and keep the preview open in toggle mode. */
function folderPreviewActions(params: FolderPreviewActionsParams): PreviewActions {
  const { folderId, mode, onLink } = params

  const run = (item: PreviewItem): boolean => {
    const rel = previewRel(folderId, item)

    if (isNil(rel)) {
      return false
    }

    onLink(rel)

    return mode.kind === 'toggle'
  }

  return { select: run, deselect: run }
}

/** Folder browser. */
export function FolderTab(props: FolderTabProps) {
  const { folderId, folderName, kinds, extensions, sub, mode } = props

  const linking = useAsyncAction(async (rel: string) => {
    try {
      const upload = await linkFolderFile({ folderId, relPath: rel })

      applyPicked(mode, upload)
    } catch (error) {
      toastError(error)
    }
  })

  const handleSelectFile = (rel: string): void => {
    void linking.run(rel)
  }

  const [broken, setBroken] = useState<string[]>([])

  const { data, isLoading } = useSWR(['folder-files', folderId, sub, kinds], () => {
    return fetchFolderFiles({ folderId, sub, kinds })
  })

  const dirs = data?.dirs ?? []

  const files = (data?.files ?? []).filter((file) => {
    return extensionAllowed({ kind: file.kind, ext: extWithDot(file.name), extensions })
  })

  const previewActions = folderPreviewActions({ folderId, mode, onLink: handleSelectFile })

  const handleExpand = (file: FolderFile) => {
    const items = files.map((each) => {
      return folderPreviewItem({ folderId, file: each })
    })

    const index = files.findIndex((each) => {
      return each.rel === file.rel
    })

    openPreview({ items, index, actions: previewActions })
  }

  const handleBroken = (src: string) => {
    setBroken((previous) => {
      return [...previous, src]
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <FolderBreadcrumbs folderName={folderName} sub={sub} onNavigate={props.onNavigate} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 content-start gap-3 p-3">
          {isLoading &&
            SKELETON.map((key) => {
              return (
                <div key={key} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
              )
            })}

          {dirs.map((dir) => {
            return <FolderDirTile key={dir.rel} dir={dir} onNavigate={props.onNavigate} />
          })}

          {files.map((file) => {
            const ref = `folders/${folderId}/${file.rel}`
            const src = thumbUrl({ ref, w: undefined, version: file.mtimeMs })
            const isBroken = broken.includes(src)

            return (
              <FolderFileTile
                key={file.rel}
                file={file}
                src={src}
                isBroken={isBroken}
                isSelected={false}
                onSelect={handleSelectFile}
                onExpand={handleExpand}
                onBroken={handleBroken}
              />
            )
          })}

          {!isLoading && isEmpty(dirs) && isEmpty(files) && (
            <p className="col-span-full py-8 text-center text-sm text-fg-2">
              No media in this folder
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
