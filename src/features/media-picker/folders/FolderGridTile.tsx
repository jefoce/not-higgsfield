'use client'

import { isNil } from 'lodash-es'

import { isFolderFileAttached } from '@/core/folder-match'
import type { FolderFile } from '@/core/media-types'
import type { UploadsById } from '@/core/schemas/upload-item'

import type { PickerMode } from '../picker/store'
import { folderFileReason } from './folder-tab-helpers'
import { FolderFileTile } from './FolderFileTile'

interface FolderGridTileProps {
  folderId: string
  folderPath: string
  file: FolderFile
  src: string
  mode: PickerMode
  selectedIds: string[]
  uploadsById: UploadsById
  linkingRel: string | null
  isBroken: boolean
  onSelect: (rel: string) => void
  onExpand: (file: FolderFile) => void
  onBroken: (src: string) => void
}

/** Folder grid tile with its live attachment and busy state. */
export function FolderGridTile(props: FolderGridTileProps) {
  const { folderId, folderPath, file, src, mode, selectedIds, uploadsById, linkingRel } = props

  const isSelected = isFolderFileAttached({ folderPath, rel: file.rel, selectedIds, uploadsById })

  const disabledReason = folderFileReason({
    mode,
    isSelected,
    id: `folder:${folderId}:${file.rel}`,
    kind: file.kind,
  })

  return (
    <FolderFileTile
      file={file}
      src={src}
      isBroken={props.isBroken}
      isSelected={isSelected}
      isDisabled={!isNil(disabledReason)}
      disabledReason={disabledReason}
      isBusy={linkingRel === file.rel}
      onSelect={props.onSelect}
      onExpand={props.onExpand}
      onBroken={props.onBroken}
    />
  )
}
