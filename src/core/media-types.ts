import type { PixelSize } from './geometry'

export type MediaKind = 'image' | 'video' | 'audio'

/** Count per media kind. */
export interface MediaKindCounts {
  image: number
  video: number
  audio: number
}

export interface FolderDir {
  name: string
  rel: string
}

export interface FolderFile {
  name: string
  rel: string
  kind: MediaKind
  sizeBytes: number
  mtimeMs: number
}

/** One folder level listing for the picker. */
export interface FolderListing {
  path: string
  dirs: FolderDir[]
  files: FolderFile[]
}

export interface BrowseDir {
  name: string
  path: string
}

/** Directory browser result for the add-folder dialog. */
export interface BrowseResult {
  path: string
  parent: string | null
  dirs: BrowseDir[]
}

/** Planned encoding for the attached images. One step for the whole request. */
export interface ReferencePlan {
  step: number
  maxSide: number
  totalBytes: number
  images: ReferencePlanImage[]
}

interface ReferencePlanImage extends PixelSize {
  id: string
  bytes: number
  format: 'jpeg' | 'png'
  flattened?: '#ffffff' | '#1c1e20'
}
