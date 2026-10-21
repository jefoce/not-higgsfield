'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { toast } from 'sonner'
import { acceptFiles, type KindExtensions } from '@/core/media-kinds'
import type { MediaKind, UploadItem } from '@/core/types'
import { isDesktop } from '@/lib/platform'
import { registerDropZone } from '@/lib/platform/drop-router'
import { errorMessage } from '@/lib/errors'
import { uploadFiles } from './api'

export interface DropUploadParams {
  /** Zone id, also written as data-drop-zone. */
  id: string
  enabled: boolean
  kinds: MediaKind[]
  extensions?: KindExtensions
  onUploaded: (items: UploadItem[]) => void
  /** Takes over copying when provided, for progress placeholders. */
  onFiles?: (files: File[]) => void
}

export interface DropProps {
  'data-drop-zone': string
  onDragEnter?: (event: DragEvent<HTMLElement>) => void
  onDragOver?: (event: DragEvent<HTMLElement>) => void
  onDragLeave?: (event: DragEvent<HTMLElement>) => void
  onDrop?: (event: DragEvent<HTMLElement>) => void
}

/** Tracks drag state and uploads files dropped on the returned handlers. */
export function useDropUpload(params: DropUploadParams): {
  dragging: boolean
  dropProps: DropProps
} {
  const { id, enabled, kinds, extensions, onUploaded, onFiles } = params
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const callback = useRef(onUploaded)
  const filesCallback = useRef(onFiles)
  const kindsRef = useRef(kinds)
  const extensionsRef = useRef(extensions)

  useEffect(() => {
    callback.current = onUploaded
    filesCallback.current = onFiles
    kindsRef.current = kinds
    extensionsRef.current = extensions
  }, [onUploaded, onFiles, kinds, extensions])

  useEffect(() => {
    if (!enabled || !isDesktop()) return
    return registerDropZone(id, {
      kinds: () => kindsRef.current,
      extensions: () => extensionsRef.current,
      onHover: setDragging,
      onUploaded: (items) => callback.current(items),
    })
  }, [id, enabled])

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled) return
      if (!event.dataTransfer.types.includes('Files')) return
      event.preventDefault()
      depth.current += 1
      setDragging(true)
    },
    [enabled],
  )

  const onDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled) return
      if (!event.dataTransfer.types.includes('Files')) return
      event.preventDefault()
    },
    [enabled],
  )

  const onDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled) return
      if (depth.current === 0) return
      event.preventDefault()
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    },
    [enabled],
  )

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled) return
      if (!event.dataTransfer.types.includes('Files')) return
      event.preventDefault()
      depth.current = 0
      setDragging(false)
      const { accepted, skipped } = acceptFiles({
        files: Array.from(event.dataTransfer.files),
        kinds,
        extensions,
      })
      if (skipped) toast(`Skipped ${skipped} unsupported file${skipped === 1 ? '' : 's'}`)
      if (!accepted.length) return
      if (filesCallback.current) {
        filesCallback.current(accepted)
        return
      }
      void uploadFiles(accepted)
        .then((items) => callback.current(items))
        .catch((error) => toast.error(errorMessage(error)))
    },
    [enabled, kinds, extensions],
  )

  const zone = { 'data-drop-zone': id }
  return {
    dragging: enabled && dragging,
    dropProps: isDesktop()
      ? zone
      : { ...zone, onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}
