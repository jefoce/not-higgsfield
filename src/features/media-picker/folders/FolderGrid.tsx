'use client'

import { isEmpty } from 'lodash-es'

import type { FolderDir, FolderFile } from '@/core/media-types'
import type { UploadsById } from '@/core/schemas/upload-item'
import { thumbUrl } from '@/lib/api/media-urls'

import type { PickerMode } from '../picker/store'
import { FolderDirTile } from './FolderDirTile'
import { FolderGridTile } from './FolderGridTile'

interface FolderGridProps {
  folderId: string
  folderPath: string
  dirs: FolderDir[]
  files: FolderFile[]
  mode: PickerMode
  selectedIds: string[]
  uploadsById: UploadsById
  linkingRel: string | null
  broken: string[]
  isLoading: boolean
  onNavigate: (sub: string) => void
  onSelect: (rel: string) => void
  onExpand: (file: FolderFile) => void
  onBroken: (src: string) => void
}

const SKELETON = [0, 1, 2, 3, 4, 5]

/** Folder grid with skeleton, directory tiles, media tiles and the empty note. */
export function FolderGrid(props: FolderGridProps) {
  const { folderId, folderPath, dirs, files, mode, selectedIds, uploadsById, linkingRel } = props

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid grid-cols-4 content-start gap-3 p-3">
        {props.isLoading &&
          SKELETON.map((key) => {
            return <div key={key} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
          })}

        {dirs.map((dir) => {
          return <FolderDirTile key={dir.rel} dir={dir} onNavigate={props.onNavigate} />
        })}

        {files.map((file) => {
          const src = thumbUrl({
            ref: `folders/${folderId}/${file.rel}`,
            w: undefined,
            version: file.mtimeMs,
          })

          return (
            <FolderGridTile
              key={file.rel}
              folderId={folderId}
              folderPath={folderPath}
              file={file}
              src={src}
              mode={mode}
              selectedIds={selectedIds}
              uploadsById={uploadsById}
              linkingRel={linkingRel}
              isBroken={props.broken.includes(src)}
              onSelect={props.onSelect}
              onExpand={props.onExpand}
              onBroken={props.onBroken}
            />
          )
        })}

        {!props.isLoading && isEmpty(dirs) && isEmpty(files) && (
          <p className="col-span-full py-8 text-center text-sm text-fg-2">
            No media in this folder
          </p>
        )}
      </div>
    </div>
  )
}
