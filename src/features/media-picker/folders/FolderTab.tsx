'use client'

import { useState } from 'react'
import { isEmpty, isNil } from 'lodash-es'
import useSWR from 'swr'

import { isNonEmptyString } from '@/core/guards'
import { extensionAllowed, extWithDot, type KindExtensions, mimeFromExt } from '@/core/media-kinds'
import type { FolderFile, MediaKind } from '@/core/media-types'
import {
  openPreview,
  type PreviewActions,
  type PreviewItem,
} from '@/features/preview/preview-store'
import { fetchFolderFiles } from '@/lib/api/folders'
import { thumbUrl } from '@/lib/api/media-urls'
import { type LatestRef, useLatest } from '@/lib/use-latest'

import { FolderBreadcrumbs } from './FolderBreadcrumbs'
import { FolderDirTile } from './FolderDirTile'
import { FolderFileTile } from './FolderFileTile'

export interface FolderTabProps {
  folderId: string
  folderName: string
  kinds: MediaKind[]
  max: number
  extensions?: KindExtensions
  sub: string
  selectedRels: string[]
  onPickFile: (rel: string) => void
  onNavigate: (sub: string) => void
  onToggleFile: (rel: string) => void
}

const SKELETON = [0, 1, 2, 3, 4, 5]

interface FolderPreviewItemParams {
  folderId: string
  file: FolderFile
}

/** Preview-only item for a folder file. Nothing links until Add. */
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

interface SelectFileParams {
  rel: string
  max: number
  onPickFile: (rel: string) => void
  onToggleFile: (rel: string) => void
}

/** Routes a file to pick or toggle based on the selection limit. */
function selectFile(params: SelectFileParams): void {
  const { rel, max, onPickFile, onToggleFile } = params

  if (max === 1) {
    onPickFile(rel)

    return
  }

  onToggleFile(rel)
}

interface FolderPreviewActionsParams {
  folderId: string
  max: number
  selectedRelsRef: LatestRef<string[]>
  onPickFile: (rel: string) => void
  onToggleFile: (rel: string) => void
}

/** Preview actions that read the live selection and keep the list open for multi-select. */
function folderPreviewActions(params: FolderPreviewActionsParams): PreviewActions {
  const { folderId, max, selectedRelsRef, onPickFile, onToggleFile } = params

  const run = (item: PreviewItem): boolean => {
    const rel = previewRel(folderId, item)

    if (isNil(rel)) {
      return false
    }

    selectFile({ rel, max, onPickFile, onToggleFile })

    return max > 1
  }

  const isSelected = (item: PreviewItem): boolean => {
    const rel = previewRel(folderId, item)

    if (isNil(rel)) {
      return false
    }

    return selectedRelsRef.current.includes(rel)
  }

  return { select: run, deselect: run, isSelected }
}

/** Folder browser. */
export function FolderTab(props: FolderTabProps) {
  const { folderId, folderName, kinds, max, extensions, sub, selectedRels } = props

  const handleSelectFile = (rel: string): void => {
    selectFile({ rel, max, onPickFile: props.onPickFile, onToggleFile: props.onToggleFile })
  }

  const [broken, setBroken] = useState<string[]>([])

  const { data, isLoading } = useSWR(['folder-files', folderId, sub, kinds], () => {
    return fetchFolderFiles({ folderId, sub, kinds })
  })

  const dirs = data?.dirs ?? []

  const files = (data?.files ?? []).filter((file) => {
    return extensionAllowed({ kind: file.kind, ext: extWithDot(file.name), extensions })
  })

  const selectedRelsRef = useLatest(selectedRels)

  const previewActions = folderPreviewActions({
    folderId,
    max,
    selectedRelsRef,
    onPickFile: props.onPickFile,
    onToggleFile: props.onToggleFile,
  })

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
                isSelected={selectedRels.includes(file.rel)}
                onPickFile={handleSelectFile}
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
