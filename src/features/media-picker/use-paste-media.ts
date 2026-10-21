'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { ClipboardEvent } from 'react'
import { toast } from 'sonner'
import { acceptFiles, pastedPath, type KindExtensions } from '@/core/media-kinds'
import type { MediaKind, UploadItem } from '@/core/types'
import { errorMessage } from '@/lib/errors'
import { linkAbsPath } from './api'

export interface PasteMediaOptions {
  enabled: boolean
  scope: 'window' | 'element'
  kinds: () => readonly MediaKind[]
  extensions?: () => KindExtensions | undefined
  onFiles: (files: File[]) => void
  onUploaded: (items: UploadItem[]) => void
}

interface PasteLike {
  clipboardData: DataTransfer | null
  target: EventTarget | null
  preventDefault: () => void
}

function handlePaste(event: PasteLike, params: PasteMediaOptions): void {
  if (!params.enabled) return
  const target = event.target instanceof HTMLElement ? event.target : null
  const files = Array.from(event.clipboardData?.files ?? [])
  const inPromptEditor = Boolean(target?.closest('[data-prompt-editor]'))
  const editing = target?.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')
  if (editing && !(inPromptEditor && files.length)) return

  if (files.length) {
    const { accepted, skipped } = acceptFiles({
      files,
      kinds: params.kinds(),
      extensions: params.extensions?.(),
    })
    if (skipped) toast(`Skipped ${skipped} unsupported file${skipped === 1 ? '' : 's'}`)
    if (!accepted.length) return
    event.preventDefault()
    params.onFiles(accepted)
    return
  }

  const path = pastedPath({
    text: event.clipboardData?.getData('text/plain') ?? '',
    kinds: params.kinds(),
    extensions: params.extensions?.(),
  })
  if (!path) return
  event.preventDefault()
  void linkAbsPath(path)
    .then((item) => params.onUploaded([item]))
    .catch((error) => toast.error(errorMessage(error)))
}

/** One paste behavior for the picker (window) and the generator panel (element). */
export function usePasteMedia(params: PasteMediaOptions): {
  onPaste?: (event: ClipboardEvent<HTMLElement>) => void
} {
  const { enabled, scope } = params
  const current = useRef(params)
  useEffect(() => {
    current.current = params
  })

  const onPaste = useCallback((event: ClipboardEvent<HTMLElement>) => {
    handlePaste(event, current.current)
  }, [])

  useEffect(() => {
    if (scope !== 'window' || !enabled) return
    const listener = (event: globalThis.ClipboardEvent) => handlePaste(event, current.current)
    window.addEventListener('paste', listener)
    return () => window.removeEventListener('paste', listener)
  }, [scope, enabled])

  return scope === 'element' ? { onPaste } : {}
}
