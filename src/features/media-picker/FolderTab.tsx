'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Film, Folder, Image as ImageIcon, Link2, Loader2, Maximize2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { extensionAllowed, extWithDot } from '@/core/media-kinds'
import type { MediaKind } from '@/core/types'
import { openPreview } from '@/features/preview/preview-store'
import { errorMessage } from '@/lib/errors'
import { fetchFolderFiles, linkFolderFile, thumbUrl } from './api'
import { FolderBreadcrumbs } from './FolderBreadcrumbs'
import type { PickerExtensions } from './store'

export interface FolderTabProps {
  folderId: string
  folderName: string
  kinds: MediaKind[]
  extensions?: PickerExtensions
  onPickFile: (rel: string) => void
}

const SKELETON = [0, 1, 2, 3, 4, 5]

/** Read-only folder browser; clicking a file links it into uploads. */
export function FolderTab(props: FolderTabProps) {
  const { folderId, folderName, kinds, extensions, onPickFile } = props
  const [sub, setSub] = useState('')
  const [broken, setBroken] = useState<string[]>([])
  const [linking, setLinking] = useState<string | null>(null)
  const { data, isLoading } = useSWR(['folder-files', folderId, sub, kinds], () =>
    fetchFolderFiles({ folderId, sub, kinds }),
  )
  const dirs = data?.dirs ?? []
  const files = (data?.files ?? []).filter((file) =>
    extensionAllowed({ kind: file.kind, ext: extWithDot(file.name), extensions: extensions }),
  )
  const empty = !isLoading && dirs.length === 0 && files.length === 0

  /** Links the file, then previews it with a Select action. Hover never links. */
  const expand = async (rel: string) => {
    setLinking(rel)
    try {
      const upload = await linkFolderFile({ folderId, relPath: rel })
      openPreview({
        items: [upload],
        index: 0,
        actions: { select: () => onPickFile(rel) }, // single item: rel is the clicked file
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLinking(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <FolderBreadcrumbs folderName={folderName} sub={sub} onNavigate={setSub} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 content-start gap-3 p-3">
          {isLoading &&
            SKELETON.map((key) => (
              <div key={key} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
            ))}

          {dirs.map((dir) => (
            <button
              key={dir.rel}
              type="button"
              onClick={() => setSub(dir.rel)}
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg bg-surface-2 px-2 text-fg-2 transition hover:bg-white/10"
            >
              <Folder className="h-6 w-6" aria-hidden />
              <span className="max-w-full truncate text-xs text-fg">{dir.name}</span>
            </button>
          ))}

          {files.map((file) => {
            const ref = `folders/${folderId}/${file.rel}`
            const src = thumbUrl({ ref, w: undefined, version: file.mtimeMs })
            const failed = broken.includes(src)
            const isAudio = file.kind === 'audio'
            return (
              <div
                key={file.rel}
                title={file.name}
                className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface text-left transition hover:opacity-90"
              >
                <button
                  type="button"
                  onClick={() => onPickFile(file.rel)}
                  aria-label={`Select ${file.name}`}
                  className="absolute inset-0 z-0 h-full w-full cursor-pointer"
                />

                {isAudio && (
                  <span className="flex h-full w-full flex-col justify-between bg-white/5 p-2">
                    <span className="truncate text-sm font-medium">{file.name}</span>
                    <span className="text-xs capitalize text-fg-2">{file.kind}</span>
                  </span>
                )}

                {!isAudio && failed && (
                  <span className="flex h-full w-full items-center justify-center bg-white/5 text-fg-2">
                    {file.kind === 'video' ? (
                      <Film size={24} aria-hidden />
                    ) : (
                      <ImageIcon size={24} aria-hidden />
                    )}
                  </span>
                )}

                {!isAudio && !failed && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized thumbs */}
                    <img
                      src={src}
                      loading="lazy"
                      alt=""
                      onError={() => setBroken((previous) => [...previous, src])}
                      className="h-full w-full bg-black/40 object-cover"
                    />
                    {file.kind === 'video' && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="h-7 w-7 fill-current" aria-hidden />
                      </span>
                    )}
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-1 text-xs">
                      {file.name}
                    </span>
                  </>
                )}

                <span className="pointer-events-none absolute left-1.5 top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded bg-black/60 text-fg">
                  <Link2 className="h-3 w-3" aria-hidden />
                </span>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void expand(file.rel)
                  }}
                  disabled={linking === file.rel}
                  aria-label={`Preview ${file.name}`}
                  className="absolute left-1/2 top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-fg opacity-0 backdrop-blur transition hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-100"
                >
                  {linking === file.rel ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Maximize2 size={16} aria-hidden />
                  )}
                </button>
              </div>
            )
          })}

          {empty && (
            <p className="col-span-full py-8 text-center text-sm text-fg-2">No media in this folder</p>
          )}
        </div>
      </div>
    </div>
  )
}
