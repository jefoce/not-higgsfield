'use client'

import { useId, useRef, useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { toast } from 'sonner'
import { acceptForKinds, type KindExtensions } from '@/core/media-kinds'
import type { MediaKind, UploadItem } from '@/core/types'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/errors'
import { uploadFilesWithProgress } from './api'

export interface UploadTileProps {
  kinds: MediaKind[]
  max: number
  extensions?: KindExtensions
  onUploaded: (items: UploadItem[]) => void
}

/** Dashed upload tile backed by a hidden file input. */
export function UploadTile(props: UploadTileProps) {
  const { kinds, max, extensions, onUploaded } = props
  const fileInputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [over, setOver] = useState(false)
  const busy = progress !== null

  const handleFiles = async (files: File[]) => {
    if (!files.length) return
    setProgress(0)
    try {
      const items = await uploadFilesWithProgress({ files, onProgress: (sent, total) => {
        setProgress(total ? Math.round((sent / total) * 100) : 0)
      } })
      onUploaded(items)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setProgress(null)
    }
  }

  return (
    <div
      className={cn(
        'relative aspect-square rounded-lg border border-dashed border-divider bg-white/[0.02] transition',
        over && 'border-lime bg-lime/5',
      )}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={() => setOver(true)}
        onDragOver={() => setOver(true)}
        onDragLeave={() => setOver(false)}
        onDrop={() => setOver(false)}
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg text-xs font-medium text-fg-2 transition hover:bg-white/[0.04]',
          busy && 'opacity-60',
        )}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
          <CloudUpload className="h-5 w-5" aria-hidden />
        </span>
        <span>{progress !== null ? `Uploading ${progress}%` : 'Upload file'}</span>
      </button>
      <input
        id={fileInputId}
        name="file"
        aria-label="Upload file"
        ref={inputRef}
        type="file"
        hidden
        accept={acceptForKinds(kinds, extensions)}
        multiple={max > 1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          void handleFiles(files)
        }}
      />
    </div>
  )
}
